
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
  "REOPENED"
];

const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// GET /api/cases
router.get("/", async (req, res) => {
  try {
    const { status, bureau, priority, search } = req.query;

    const conditions = [];
    const params = [];

    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter"
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
          message: "Invalid priority filter"
        });
      }
      conditions.push("c.priority = ?");
      params.push(priority);
    }

    if (search) {
      conditions.push(
        "(c.case_number LIKE ? OR c.subject LIKE ? OR i.permanent_id LIKE ?)"
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await pool.execute(
      `SELECT
         c.id, c.case_number, c.subject, c.description,
         c.bureau_name, c.complaint_type, c.priority,
         c.status, c.received_at, c.due_date, c.resolved_at,
         i.permanent_id, i.institution_name,
         u.full_name AS assigned_officer
       FROM complaint_cases c
       JOIN institutions i ON i.id = c.institution_id
       LEFT JOIN users u ON u.id = c.assigned_to
       ${where}
       ORDER BY c.received_at DESC
       LIMIT 200`,
      params
    );

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Fetch cases:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch complaint cases"
    });
  }
});

// POST /api/cases
router.post("/", async (req, res) => {
  const {
    institution_id,
    subject,
    description,
    bureau_name,
    complaint_type,
    priority = "MEDIUM",
    due_date
  } = req.body;

  if (
    !Number.isInteger(institution_id) ||
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
      message: "Valid institution, subject, description and bureau are required"
    });
  }

  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: "Invalid priority"
    });
  }

  if (
    due_date !== undefined &&
    due_date !== null &&
    (typeof due_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(due_date) ||
      Number.isNaN(Date.parse(`${due_date}T00:00:00Z`)) ||
      new Date(`${due_date}T00:00:00Z`).toISOString().slice(0, 10) !== due_date)
  ) {
    return res.status(400).json({
      success: false,
      message: "Due date must be a valid YYYY-MM-DD date"
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [institutions] = await connection.execute(
      "SELECT id FROM institutions WHERE id = ?",
      [institution_id]
    );

    if (!institutions.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Institution not found"
      });
    }

    const caseNumber =
      `AICTE-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    const [result] = await connection.execute(
      `INSERT INTO complaint_cases
       (case_number, institution_id, subject, description,
        bureau_name, complaint_type, priority, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?)`,
      [
        caseNumber,
        institution_id,
        subject.trim(),
        description.trim(),
        bureau_name.trim(),
        complaint_type || null,
        priority,
        due_date || null
      ]
    );

    await connection.execute(
      `INSERT INTO case_actions
       (case_id, action_type, new_status, notes)
       VALUES (?, 'CASE_CREATED', 'RECEIVED', 'Complaint registered')`,
      [result.insertId]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Complaint created",
      data: {
        id: result.insertId,
        case_number: caseNumber,
        status: "RECEIVED"
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error("Create case:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not create complaint"
    });
  } finally {
    connection.release();
  }
});

// PATCH /api/cases/:id/status
router.patch("/:id/status", async (req, res) => {
  const caseId = Number(req.params.id);
  const { status, notes } = req.body;

  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID"
    });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status"
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [cases] = await connection.execute(
      "SELECT id, status FROM complaint_cases WHERE id = ? FOR UPDATE",
      [caseId]
    );

    if (!cases.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    const previousStatus = cases[0].status;

    await connection.execute(
      `UPDATE complaint_cases
       SET status = ?,
           resolved_at = CASE
             WHEN ? = 'RESOLVED' THEN CURRENT_TIMESTAMP
             WHEN ? = 'REOPENED' THEN NULL
             ELSE resolved_at
           END
       WHERE id = ?`,
      [status, status, status, caseId]
    );

    await connection.execute(
      `INSERT INTO case_actions
       (case_id, action_type, previous_status, new_status, notes)
       VALUES (?, 'STATUS_CHANGED', ?, ?, ?)`,
      [caseId, previousStatus, status, notes || null]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Complaint status updated",
      data: {
        id: caseId,
        previous_status: previousStatus,
        status
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error("Update case status:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not update complaint status"
    });
  } finally {
    connection.release();
  }
});

// GET /api/cases/:id/history
router.get("/:id/history", async (req, res) => {
  const caseId = Number(req.params.id);

  if (!Number.isInteger(caseId) || caseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID"
    });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, action_type, previous_status, new_status,
              notes, performed_by, created_at
       FROM case_actions
       WHERE case_id = ?
       ORDER BY created_at ASC, id ASC`,
      [caseId]
    );

    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Fetch case history:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch case history"
    });
  }
});

export default router;
