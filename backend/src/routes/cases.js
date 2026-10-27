
import express from "express";
import pool from "../config/db.js";

const router = express.Router();

const allowedStatuses = [
  "RECEIVED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "AWAITING_RESPONSE",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];

const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// Validate a positive integer ID.
function isValidId(id) {
  return Number.isSafeInteger(id) && id > 0;
}

// Validate YYYY-MM-DD without accepting impossible calendar dates.
function isValidDate(date) {
  if (typeof date !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

// GET /api/cases
// Optional filters: status, bureau, priority, search
router.get("/", async (req, res) => {
  try {
    const { status, bureau, priority, search } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }

      conditions.push("c.status = ?");
      params.push(status);
    }

    if (bureau) {
      conditions.push("c.bureau_name = ?");
      params.push(bureau);
    }

    if (priority) {
      if (!allowedPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority filter",
        });
      }

      conditions.push("c.priority = ?");
      params.push(priority);
    }

    if (search) {
      conditions.push(
        `(c.case_number LIKE ?
          OR c.subject LIKE ?
          OR i.permanent_id LIKE ?
          OR i.institution_name LIKE ?)`
      );

      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await pool.execute(
      `SELECT
         c.id,
         c.case_number,
         c.subject,
         c.description,
         c.bureau_name,
         c.complaint_type,
         c.priority,
         c.status,
         c.received_at,
         c.due_date,
         c.resolved_at,
         i.id AS institution_id,
         i.permanent_id,
         i.institution_name,
         u.full_name AS assigned_officer
       FROM complaint_cases c
       JOIN institutions i ON i.id = c.institution_id
       LEFT JOIN users u ON u.id = c.assigned_to
       ${whereClause}
       ORDER BY c.received_at DESC
       LIMIT 200`,
      params
    );

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Fetch cases:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not fetch complaint cases",
    });
  }
});

// POST /api/cases
// Register a new complaint and record its initial history entry.
router.post("/", async (req, res) => {
  const {
    institution_id,
    subject,
    description,
    bureau_name,
    complaint_type,
    priority = "MEDIUM",
    due_date = null,
  } = req.body;

  if (
    !Number.isSafeInteger(institution_id) ||
    institution_id <= 0 ||
    typeof subject !== "string" ||
    !subject.trim() ||
    typeof description !== "string" ||
    !description.trim() ||
    typeof bureau_name !== "string" ||
    !bureau_name.trim()
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Valid institution, subject, description and bureau are required",
    });
  }

  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: "Invalid priority",
    });
  }

  if (complaint_type != null && typeof complaint_type !== "string") {
    return res.status(400).json({
      success: false,
      message: "Complaint type must be a string",
    });
  }

  if (due_date !== null && !isValidDate(due_date)) {
    return res.status(400).json({
      success: false,
      message: "Due date must be a valid YYYY-MM-DD date",
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [institutions] = await connection.execute(
      "SELECT id FROM institutions WHERE id = ?",
      [institution_id]
    );

    if (!institutions.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

    const caseNumber =
      `AICTE-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    const [result] = await connection.execute(
      `INSERT INTO complaint_cases
       (
         case_number,
         institution_id,
         subject,
         description,
         bureau_name,
         complaint_type,
         priority,
         status,
         due_date
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?)`,
      [
        caseNumber,
        institution_id,
        subject.trim(),
        description.trim(),
        bureau_name.trim(),
        complaint_type?.trim() || null,
        priority,
        due_date,
      ]
    );

    await connection.execute(
      `INSERT INTO case_actions
       (case_id, action_type, new_status, notes)
       VALUES (?, 'CASE_CREATED', 'RECEIVED', ?)`,
      [result.insertId, "Complaint registered"]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Complaint created",
      data: {
        id: result.insertId,
        case_number: caseNumber,
        status: "RECEIVED",
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Create case rollback:", rollbackError.message);
      }
    }

    console.error("Create case:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not create complaint",
    });
  } finally {
    connection?.release();
  }
});

// PATCH /api/cases/:id/status
// Update status and record the change in the audit history.
router.patch("/:id/status", async (req, res) => {
  const caseId = Number(req.params.id);
  const { status, notes } = req.body;

  if (!isValidId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID",
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status",
    });
  }

  if (
    notes !== undefined &&
    notes !== null &&
    typeof notes !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Notes must be a string",
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [cases] = await connection.execute(
      `SELECT id, status
       FROM complaint_cases
       WHERE id = ?
       FOR UPDATE`,
      [caseId]
    );

    if (!cases.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    const previousStatus = cases[0].status;

    // Avoid creating misleading audit events for unchanged statuses.
    if (previousStatus === status) {
      await connection.rollback();

      return res.json({
        success: true,
        message: "Complaint already has this status",
        data: {
          id: caseId,
          previous_status: previousStatus,
          status,
          unchanged: true,
        },
      });
    }

    await connection.execute(
      `UPDATE complaint_cases
       SET status = ?,
           resolved_at = CASE
             WHEN ? = 'RESOLVED' THEN CURRENT_TIMESTAMP
             WHEN ? IN ('REOPENED', 'IN_PROGRESS', 'UNDER_REVIEW',
                        'RECEIVED', 'AWAITING_RESPONSE') THEN NULL
             ELSE resolved_at
           END
       WHERE id = ?`,
      [status, status, status, caseId]
    );

    await connection.execute(
      `INSERT INTO case_actions
       (case_id, action_type, previous_status, new_status, notes)
       VALUES (?, 'STATUS_CHANGED', ?, ?, ?)`,
      [
        caseId,
        previousStatus,
        status,
        notes?.trim() || null,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Complaint status updated",
      data: {
        id: caseId,
        previous_status: previousStatus,
        status,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Status update rollback:", rollbackError.message);
      }
    }

    console.error("Update case status:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not update complaint status",
    });
  } finally {
    connection?.release();
  }
});

// GET /api/cases/:id/history
// Return the chronological audit trail for one complaint.
router.get("/:id/history", async (req, res) => {
  const caseId = Number(req.params.id);

  if (!isValidId(caseId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID",
    });
  }

  try {
    const [cases] = await pool.execute(
      `SELECT id, case_number, subject
       FROM complaint_cases
       WHERE id = ?`,
      [caseId]
    );

    if (!cases.length) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    const [history] = await pool.execute(
      `SELECT
         ca.id,
         ca.action_type,
         ca.previous_status,
         ca.new_status,
         ca.notes,
         ca.performed_by,
         u.full_name AS performed_by_name,
         ca.created_at
       FROM case_actions ca
       LEFT JOIN users u ON u.id = ca.performed_by
       WHERE ca.case_id = ?
       ORDER BY ca.created_at ASC, ca.id ASC`,
      [caseId]
    );

    return res.json({
      success: true,
      data: {
        case: cases[0],
        count: history.length,
        history,
      },
    });
  } catch (error) {
    console.error("Fetch case history:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not fetch case history",
    });
  }
});

export default router;
