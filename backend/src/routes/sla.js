
import express from "express";
import pool from "../config/db.js";
import { enrichCaseWithSla } from "../services/slaService.js";

const router = express.Router();

// GET /api/sla
// GET /api/sla?risk=OVERDUE
router.get("/", async (req, res) => {
  try {
    const allowedRisks = [
      "ON_TRACK",
      "AT_RISK",
      "CRITICAL",
      "OVERDUE",
      "COMPLETED",
      "NO_DEADLINE",
      "INVALID_DEADLINE"
    ];

    const requestedRisk = req.query.risk
      ? String(req.query.risk).toUpperCase()
      : null;

    if (requestedRisk && !allowedRisks.includes(requestedRisk)) {
      return res.status(400).json({
        success: false,
        message: "Invalid SLA risk filter"
      });
    }

    const [rows] = await pool.execute(`
      SELECT
        c.id,
        c.case_number,
        c.subject,
        c.description,
        c.bureau_name,
        c.priority,
        c.status,
        c.received_at,
        c.due_date,
        i.permanent_id,
        i.institution_name,
        u.full_name AS assigned_officer
      FROM complaint_cases c
      JOIN institutions i ON i.id = c.institution_id
      LEFT JOIN users u ON u.id = c.assigned_to
      ORDER BY c.due_date IS NULL, c.due_date ASC
      LIMIT 500
    `);

    const now = new Date();
    const enrichedCases = rows.map(row => enrichCaseWithSla(row, now));

    const filteredCases = requestedRisk
      ? enrichedCases.filter(
          item => item.sla.risk_level === requestedRisk
        )
      : enrichedCases;

    const summary = {
      total: enrichedCases.length,
      on_track: 0,
      at_risk: 0,
      critical: 0,
      overdue: 0,
      completed: 0,
      no_deadline: 0,
      invalid_deadline: 0,
      escalation_required: 0
    };

    for (const item of enrichedCases) {
      const key = item.sla.risk_level.toLowerCase();

      if (Object.hasOwn(summary, key)) {
        summary[key]++;
      }

      if (item.sla.escalation_required) {
        summary.escalation_required++;
      }
    }

    return res.json({
      success: true,
      count: filteredCases.length,
      summary,
      data: filteredCases
    });
  } catch (error) {
    console.error("Fetch SLA risks:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not calculate SLA risks"
    });
  }
});

export default router;
