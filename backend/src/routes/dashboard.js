import express from "express";
import ComplaintCase from "../models/ComplaintCase.js";

const router = express.Router();

router.get("/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const bureauFilter =
      req.user.role === "BUREAU_OFFICER"
        ? { bureau_name: req.user.bureau_name }
        : {};

    const [totalCases, openCases, resolvedCases, urgentCases, overdueCases, byBureau, byStatus] =
      await Promise.all([
        ComplaintCase.countDocuments(bureauFilter),
        ComplaintCase.countDocuments({
          ...bureauFilter,
          status: { $nin: ["RESOLVED", "CLOSED"] },
        }),
        ComplaintCase.countDocuments({ ...bureauFilter, status: "RESOLVED" }),
        ComplaintCase.countDocuments({
          ...bureauFilter,
          priority: "URGENT",
          status: { $nin: ["RESOLVED", "CLOSED"] },
        }),
        ComplaintCase.countDocuments({
          ...bureauFilter,
          due_date: { $lt: today },
          status: { $nin: ["RESOLVED", "CLOSED"] },
        }),
        ComplaintCase.aggregate([
          ...(req.user.role === "BUREAU_OFFICER"
            ? [{ $match: bureauFilter }]
            : []),
          { $group: { _id: "$bureau_name", total: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $project: { _id: 0, bureau_name: "$_id", total: 1 } },
        ]),
        ComplaintCase.aggregate([
          ...(req.user.role === "BUREAU_OFFICER"
            ? [{ $match: bureauFilter }]
            : []),
          { $group: { _id: "$status", total: { $sum: 1 } } },
          { $sort: { total: -1 } },
          { $project: { _id: 0, status: "$_id", total: 1 } },
        ]),
      ]);

    res.json({
      success: true,
      data: {
        totals: {
          total_cases: totalCases,
          open_cases: openCases,
          resolved_cases: resolvedCases,
          urgent_cases: urgentCases,
          overdue_cases: overdueCases,
        },
        by_bureau: byBureau,
        by_status: byStatus,
      },
    });
  } catch (error) {
    console.error("Dashboard stats:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch dashboard statistics",
    });
  }
});

export default router;
