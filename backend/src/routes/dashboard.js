
import express from "express";
import pool from "../config/db.js";

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const [[totals]] = await pool.query(`
      SELECT
        COUNT(*) AS total_cases,
        SUM(status NOT IN ('RESOLVED', 'CLOSED')) AS open_cases,
        SUM(status = 'RESOLVED') AS resolved_cases,
        SUM(priority = 'URGENT'
            AND status NOT IN ('RESOLVED', 'CLOSED')) AS urgent_cases,
        SUM(
          due_date < CURRENT_DATE
          AND status NOT IN ('RESOLVED', 'CLOSED')
        ) AS overdue_cases
      FROM complaint_cases
    `);

    const [byBureau] = await pool.query(`
      SELECT bureau_name, COUNT(*) AS total
      FROM complaint_cases
      GROUP BY bureau_name
      ORDER BY total DESC
    `);

    const [byStatus] = await pool.query(`
      SELECT status, COUNT(*) AS total
      FROM complaint_cases
      GROUP BY status
      ORDER BY total DESC
    `);

    res.json({
      success: true,
      data: {
        totals: {
          total_cases: Number(totals.total_cases || 0),
          open_cases: Number(totals.open_cases || 0),
          resolved_cases: Number(totals.resolved_cases || 0),
          urgent_cases: Number(totals.urgent_cases || 0),
          overdue_cases: Number(totals.overdue_cases || 0)
        },
        by_bureau: byBureau,
        by_status: byStatus
      }
    });
  } catch (error) {
    console.error("Dashboard stats:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch dashboard statistics"
    });
  }
});

export default router;
