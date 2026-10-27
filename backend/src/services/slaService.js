
const CLOSED_STATUSES = new Set(["RESOLVED", "CLOSED"]);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function calculateSlaRisk(caseRecord, now = new Date()) {
  const status = String(caseRecord.status || "").toUpperCase();
  const priority = String(caseRecord.priority || "MEDIUM").toUpperCase();

  // Resolved and closed complaints no longer need an active SLA warning.
  if (CLOSED_STATUSES.has(status)) {
    return {
      risk_level: "COMPLETED",
      hours_remaining: null,
      overdue_hours: 0,
      escalation_required: false,
      recommended_action: "No action required. Complaint is closed."
    };
  }

  if (!caseRecord.due_date) {
    return {
      risk_level: "NO_DEADLINE",
      hours_remaining: null,
      overdue_hours: 0,
      escalation_required: false,
      recommended_action: "Set a due date to enable SLA monitoring."
    };
  }

  const dueTime = new Date(caseRecord.due_date).getTime();

  if (!Number.isFinite(dueTime)) {
    return {
      risk_level: "INVALID_DEADLINE",
      hours_remaining: null,
      overdue_hours: 0,
      escalation_required: false,
      recommended_action: "Correct the complaint due date."
    };
  }

  const differenceMs = dueTime - now.getTime();
  const hoursRemaining = Math.ceil(differenceMs / (60 * 60 * 1000));
  const overdueHours = differenceMs < 0
    ? Math.ceil(Math.abs(differenceMs) / (60 * 60 * 1000))
    : 0;

  let riskLevel;
  let action;

  if (differenceMs < 0) {
    riskLevel = "OVERDUE";
    action = "Escalate to the responsible officer and review the delay.";
  } else if (differenceMs <= 24 * 60 * 60 * 1000) {
    riskLevel = "CRITICAL";
    action = "Prioritize this complaint and review it immediately.";
  } else if (differenceMs <= 72 * 60 * 60 * 1000) {
    riskLevel = "AT_RISK";
    action = "Notify the responsible officer and monitor progress.";
  } else {
    riskLevel = "ON_TRACK";
    action = "Continue normal processing and monitor the deadline.";
  }

  // Urgent cases receive attention even when their deadline is further away.
  const escalationRequired =
    riskLevel === "OVERDUE" ||
    riskLevel === "CRITICAL" ||
    priority === "URGENT";

  return {
    risk_level: riskLevel,
    hours_remaining: hoursRemaining,
    overdue_hours: overdueHours,
    escalation_required: escalationRequired,
    recommended_action: action
  };
}

export function enrichCaseWithSla(caseRecord, now = new Date()) {
  return {
    ...caseRecord,
    sla: calculateSlaRisk(caseRecord, now)
  };
}
