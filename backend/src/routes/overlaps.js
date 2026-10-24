
import express from "express";
import pool from "../config/db.js";
import { detectOverlaps } from "../services/overlapDetection.js";

const router = express.Router();

// POST /api/overlaps/scan
router.post("/scan", async (req, res) => {
  try {
    const result = await detectOverlaps();

    res.json({
      success: true,
      message: "Overlap scan completed",
      data: result
    });
  } catch (error) {
    console.error("Overlap scan:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not run overlap detection"
    });
  }
});

// GET /api/overlaps?status=PENDING
router.get("/", async (req, res) => {
  try {
    const { status = "PENDING" } = req.query;

    const allowed = ["PENDING", "REVIEWED", "DISMISSED", "ALL"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert status"
      });
    }

    const where = status === "ALL" ? "" : "WHERE a.status = ?";
    const params = status === "ALL" ? [] : [status];

    const [rows] = await pool.execute(
      `SELECT
         a.id AS alert_id,
         a.case_id,
         a.related_case_id,
         a.alert_reason,
         a.confidence_score,
         a.status AS alert_status,
         a.reviewed_by,
         a.reviewed_at,
         a.created_at,
         c1.case_number AS case_number,
         c1.subject AS subject,
         c1.bureau_name AS bureau_name,
         c1.status AS case_status,
         c2.case_number AS related_case_number,
         c2.subject AS related_subject,
         c2.bureau_name AS related_bureau,
         i.permanent_id,
         i.institution_name
       FROM overlap_alerts a
       JOIN complaint_cases c1 ON c1.id = a.case_id
       JOIN complaint_cases c2 ON c2.id = a.related_case_id
       JOIN institutions i ON i.id = c1.institution_id
       ${where}
       ORDER BY
         CASE WHEN a.status = 'PENDING' THEN 0 ELSE 1 END,
         a.confidence_score DESC,
         a.created_at DESC`,
      params
    );

    const data = rows.map((row) => {
      let explanation = row.alert_reason;

      try {
        explanation = JSON.parse(row.alert_reason);
      } catch {
        // Older alerts may contain plain-text explanations.
      }

      return { ...row, explanation };
    });

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error("Fetch overlap alerts:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not fetch overlap alerts"
    });
  }
});

// PATCH /api/overlaps/:id/review
router.patch("/:id/review", async (req, res) => {
  const alertId = Number(req.params.id);
  const { decision, notes = "" } = req.body;

  if (!Number.isInteger(alertId) || alertId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid alert ID"
    });
  }

  const decisions = ["CONFIRMED", "RELATED", "DISMISSED"];

  if (!decisions.includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Decision must be CONFIRMED, RELATED or DISMISSED"
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [alerts] = await connection.execute(
      `SELECT id, case_id, related_case_id, status
       FROM overlap_alerts
       WHERE id = ?
       FOR UPDATE`,
      [alertId]
    );

    if (!alerts.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Overlap alert not found"
      });
    }

    const alert = alerts[0];

    if (alert.status !== "PENDING") {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This alert has already been reviewed"
      });
    }

    if (decision === "DISMISSED") {
      await connection.execute(
        `UPDATE overlap_alerts
         SET status = 'DISMISSED', reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [alertId]
      );
    } else {
      const relationshipType =
        decision === "CONFIRMED"
          ? "POTENTIAL_DUPLICATE"
          : "RELATED_COMPLAINT";

      await connection.execute(
        `INSERT INTO case_links
         (case_id, related_case_id, relationship_type,
          confidence_score, review_status, reviewed_at)
         SELECT ?, ?, ?, a.confidence_score, 'CONFIRMED',
                CURRENT_TIMESTAMP
         FROM overlap_alerts a
         WHERE a.id = ?
         ON DUPLICATE KEY UPDATE
           relationship_type = VALUES(relationship_type),
           confidence_score = VALUES(confidence_score),
           review_status = 'CONFIRMED',
           reviewed_at = CURRENT_TIMESTAMP`,
        [
          alert.case_id,
          alert.related_case_id,
          relationshipType,
          alertId
        ]
      );

      await connection.execute(
        `UPDATE overlap_alerts
         SET status = 'REVIEWED', reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [alertId]
      );
    }

    // Keep the officer's review explanation in the case history.
    await connection.execute(
      `INSERT INTO case_actions
       (case_id, action_type, notes)
       VALUES (?, 'OVERLAP_REVIEW', ?)`,
      [
        alert.case_id,
        `Alert ${alertId}: ${decision}. ${String(notes).slice(0, 1000)}`
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: `Alert ${decision.toLowerCase()} successfully`,
      data: {
        alert_id: alertId,
        decision
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error("Review overlap alert:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not save review decision"
    });
  } finally {
    connection.release();
  }
});

export default router;
