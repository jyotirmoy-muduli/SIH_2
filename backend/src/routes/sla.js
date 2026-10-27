import express from "express";
import ComplaintCase from "../models/ComplaintCase.js";
import "../models/Institution.js";
import "../models/User.js";
import { SLA_THRESHOLDS } from "../config/sla.js";
import { enrichCaseWithSla } from "../services/slaService.js";

const router = express.Router();
const allowedRisks = [
  "ON_TRACK",
  "AT_RISK",
  "CRITICAL",
  "OVERDUE",
  "COMPLETED",
  "NO_DEADLINE",
  "INVALID_DEADLINE",
];
const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

async function getSlaRisks(req, res) {
  try {
    const rawRisk = req.query.risk;
    const requestedRisk =
      typeof rawRisk === "string" && rawRisk
        ? rawRisk.toUpperCase()
        : null;
    const rawPriority = req.query.priority;
    const requestedPriority =
      typeof rawPriority === "string" && rawPriority
        ? rawPriority.toUpperCase()
        : null;
    const rawBureau = req.query.bureau;
    const requestedBureau =
      typeof rawBureau === "string" ? rawBureau.trim() : "";

    if (
      (rawRisk !== undefined &&
        rawRisk !== "" &&
        (typeof rawRisk !== "string" || !allowedRisks.includes(requestedRisk))) ||
      (rawPriority !== undefined &&
        rawPriority !== "" &&
        (typeof rawPriority !== "string" ||
          !allowedPriorities.includes(requestedPriority))) ||
      (rawBureau !== undefined &&
        (typeof rawBureau !== "string" || requestedBureau.length > 100))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid SLA risk, bureau or priority filter",
      });
    }

    const filter = {};
    if (requestedPriority) filter.priority = requestedPriority;
    if (requestedBureau) filter.bureau_name = requestedBureau;
    if (req.user.role === "BUREAU_OFFICER") {
      if (requestedBureau && requestedBureau !== req.user.bureau_name) {
        return res.status(403).json({
          success: false,
          message: "You can only view SLA cases for your bureau",
        });
      }
      filter.bureau_name = req.user.bureau_name;
    }

    const records = await ComplaintCase.find(filter)
      .select(
        "case_number subject description bureau_name priority status received_at due_date institution_id assigned_to"
      )
      .populate("institution_id", "permanent_id institution_name")
      .populate("assigned_to", "full_name")
      .sort({ due_date: 1, received_at: -1 });
    const now = new Date();
    const enrichedCases = records.map((record) =>
      enrichCaseWithSla(
        {
          id: record.id,
          case_number: record.case_number,
          subject: record.subject,
          description: record.description,
          bureau_name: record.bureau_name,
          priority: record.priority,
          status: record.status,
          received_at: record.received_at,
          due_date: record.due_date,
          institution_id: record.institution_id?.id || record.institution_id,
          permanent_id: record.institution_id?.permanent_id,
          institution_name: record.institution_id?.institution_name,
          assigned_officer: record.assigned_to?.full_name || null,
        },
        now
      )
    );
    const filteredCases = requestedRisk
      ? enrichedCases.filter((item) => item.sla.risk_level === requestedRisk)
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
      escalation_required: 0,
    };

    for (const item of enrichedCases) {
      summary[item.sla.risk_level.toLowerCase()] += 1;
      if (item.sla.escalation_required) summary.escalation_required += 1;
    }

    return res.json({
      success: true,
      count: filteredCases.length,
      summary,
      thresholds: {
        critical_hours: SLA_THRESHOLDS.criticalHours,
        at_risk_hours: SLA_THRESHOLDS.atRiskHours,
      },
      data: filteredCases,
    });
  } catch (error) {
    console.error("Fetch SLA risks:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not calculate SLA risks",
    });
  }
}

router.get("/", getSlaRisks);
router.get("/risks", getSlaRisks);

export default router;
