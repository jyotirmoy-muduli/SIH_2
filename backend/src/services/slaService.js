
import { SLA_THRESHOLDS } from "../config/sla.js";

const CLOSED_STATUSES = new Set(["RESOLVED", "CLOSED"]);

export function calculateSlaRisk(
  caseRecord,
  now = new Date(),
  thresholds = SLA_THRESHOLDS
) {
  const status = String(caseRecord.status || "").toUpperCase();
  const priority = String(caseRecord.priority || "MEDIUM").toUpperCase();
  const statusDescription = status
    ? `Current status: ${status.toLowerCase().replaceAll("_", " ")}.`
    : "";

  if (CLOSED_STATUSES.has(status)) {
    return {
      risk_level: "COMPLETED",
      hours_remaining: null,
      overdue_hours: 0,
      escalation_required: false,
      explanation: `This complaint is ${status.toLowerCase()} and is excluded from active SLA escalation.`,
      recommended_action: "No action required. Complaint is closed.",
    };
  }

  if (!caseRecord.due_date) {
    return {
      risk_level: "NO_DEADLINE",
      hours_remaining: null,
      overdue_hours: 0,
      escalation_required: false,
      explanation: `${statusDescription}No due date is recorded, so remaining time cannot be calculated.`,
      recommended_action: "Set and verify a due date to enable SLA monitoring.",
    };
  }

  const dueTime = new Date(caseRecord.due_date).getTime();

  if (!Number.isFinite(dueTime)) {
    return {
      risk_level: "INVALID_DEADLINE",
      hours_remaining: null,
      overdue_hours: 0,
      escalation_required: false,
      explanation: `${statusDescription}The stored due date is not a valid date.`,
      recommended_action: "Correct the complaint due date before assessing its SLA.",
    };
  }

  const differenceMs = dueTime - now.getTime();
  const hoursRemaining = Math.ceil(differenceMs / (60 * 60 * 1000));
  const overdueHours = differenceMs < 0
    ? Math.ceil(Math.abs(differenceMs) / (60 * 60 * 1000))
    : 0;

  const baseRisk =
    differenceMs < 0
      ? "OVERDUE"
      : differenceMs <= thresholds.criticalHours * 60 * 60 * 1000
        ? "CRITICAL"
        : differenceMs <= thresholds.atRiskHours * 60 * 60 * 1000
          ? "AT_RISK"
          : "ON_TRACK";
  const riskOrder = ["ON_TRACK", "AT_RISK", "CRITICAL", "OVERDUE"];
  const riskLevel =
    priority === "URGENT" && baseRisk !== "OVERDUE"
      ? riskOrder[Math.min(riskOrder.indexOf(baseRisk) + 1, 2)]
      : baseRisk;
  const priorityDescription = `Priority: ${priority.toLowerCase()}.`;
  const remainingDescription =
    differenceMs < 0
      ? `The deadline passed ${overdueHours} hour${overdueHours === 1 ? "" : "s"} ago.`
      : `There are ${hoursRemaining} hour${hoursRemaining === 1 ? "" : "s"} remaining.`;
  const priorityEscalation =
    priority === "URGENT" && baseRisk !== riskLevel
      ? " Urgent priority raises this case by one risk level."
      : "";

  const escalationRequired =
    riskLevel === "OVERDUE" ||
    riskLevel === "CRITICAL" ||
    (priority === "URGENT" && riskLevel === "AT_RISK");
  let recommendedAction;

  if (riskLevel === "OVERDUE") {
    recommendedAction =
      "Escalate to a supervisor, contact the responsible bureau, and review the delay.";
  } else if (riskLevel === "CRITICAL") {
    recommendedAction =
      "Contact the responsible bureau now and prioritize this complaint for immediate review.";
  } else if (riskLevel === "AT_RISK") {
    recommendedAction =
      "Review progress and contact the responsible bureau to confirm the next action.";
  } else {
    recommendedAction = "Continue normal processing and monitor the deadline.";
  }

  if (status === "AWAITING_RESPONSE" && riskLevel !== "OVERDUE") {
    recommendedAction =
      "Follow up with the party expected to respond and update the responsible bureau.";
  }

  return {
    risk_level: riskLevel,
    hours_remaining: hoursRemaining,
    overdue_hours: overdueHours,
    escalation_required: escalationRequired,
    explanation: `${remainingDescription} ${statusDescription} ${priorityDescription}${priorityEscalation}`.trim(),
    recommended_action: recommendedAction,
  };
}

export function enrichCaseWithSla(caseRecord, now = new Date()) {
  return {
    ...caseRecord,
    sla: calculateSlaRisk(caseRecord, now)
  };
}
