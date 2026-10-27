import { calculateSlaRisk } from "./slaService.js";
import { assessResolutionIntegrity } from "./resolutionIntegrity.js";

function isBlank(value) {
  return typeof value !== "string" || value.trim().length === 0;
}

function makeRecommendation({
  action,
  explanation,
  facts,
  urgency,
  responsible_role,
}) {
  return {
    action,
    explanation,
    supporting_facts: facts,
    urgency,
    suggested_responsible_role: responsible_role,
    method: "deterministic_rules",
    is_suggestion: true,
  };
}

export function recommendNextAction(
  complaint,
  { confirmedRelatedCount = 0, pendingOverlapCount = 0, now = new Date() } = {}
) {
  const facts = [
    `Current status: ${complaint.status || "UNKNOWN"}.`,
    `Priority: ${complaint.priority || "UNKNOWN"}.`,
  ];
  const history = complaint.actions || [];
  const risk = calculateSlaRisk(complaint, now);
  if (complaint.due_date) {
    facts.push(
      risk.risk_level === "OVERDUE"
        ? `Deadline is overdue by ${risk.overdue_hours} hour(s).`
        : `${risk.hours_remaining} hour(s) remain until the deadline.`
    );
  } else {
    facts.push("No deadline is recorded.");
  }

  if (complaint.status === "CLOSED") {
    return makeRecommendation({
      action: "NO_ACTION_REQUIRED",
      explanation:
        "The complaint is resolved or closed; do not recommend additional processing unless it is explicitly reopened.",
      facts,
      urgency: "NONE",
      responsible_role: "NONE",
    });
  }

  if (risk.risk_level === "OVERDUE") {
    return makeRecommendation({
      action: "ESCALATE_OVERDUE_CASE",
      explanation:
        "The recorded deadline has passed while the complaint remains active. An official should review the delay and decide whether escalation is appropriate.",
      facts: [...facts, risk.explanation],
      urgency: "CRITICAL",
      responsible_role: "SUPERVISOR",
    });
  }

  if (complaint.status === "RESOLVED") {
    const integrity = assessResolutionIntegrity(complaint);
    if (integrity.status === "CHECKS_PASSED") {
      return makeRecommendation({
        action: "NO_ACTION_REQUIRED",
        explanation:
          "The complaint is resolved and its configured checklist has no outstanding items. Do not recommend further processing unless it is explicitly reopened.",
        facts,
        urgency: "NONE",
        responsible_role: "NONE",
      });
    } else {
      return makeRecommendation({
        action: "REVIEW_RESOLUTION_RECORD",
        explanation:
          "The complaint is marked resolved, but its resolution checklist has missing items or items requiring human review.",
        facts: [
          ...facts,
          `${integrity.mandatory_failures.length} mandatory requirement(s) are missing.`,
          ...integrity.checks
            .filter((item) => item.status !== "PASS")
            .slice(0, 3)
            .map((item) => item.explanation),
        ],
        urgency: integrity.status === "INCOMPLETE" ? "HIGH" : "MEDIUM",
        responsible_role: "BUREAU_OFFICER",
      });
    }
  }

  if (complaint.status === "AWAITING_RESPONSE") {
    const responseWaits = history.filter(
      (action) =>
        action.action_type === "STATUS_CHANGED" &&
        action.new_status === "AWAITING_RESPONSE"
    ).length;
    return makeRecommendation({
      action: "FOLLOW_UP_ON_RESPONSE",
      explanation:
        "The current workflow is waiting for a response. Follow up with the responsible party and record the outcome; this recommendation does not send a notification.",
      facts: [
        ...facts,
        `History contains ${responseWaits} transition(s) to awaiting response.`,
        `Assigned owner: ${complaint.assigned_to?.full_name || "none recorded"}.`,
      ],
      urgency:
        risk.risk_level === "CRITICAL" ? "CRITICAL" : "HIGH",
      responsible_role: complaint.assigned_to ? "CASE_OWNER" : "BUREAU_OFFICER",
    });
  }

  if (isBlank(complaint.description)) {
    return makeRecommendation({
      action: "REQUEST_MISSING_INFORMATION",
      explanation:
        "The complaint description is missing. Request sufficient details before attempting substantive review.",
      facts: [...facts, "No usable complaint description is recorded."],
      urgency: "MEDIUM",
      responsible_role: "BUREAU_OFFICER",
    });
  }

  if (!complaint.assigned_to) {
    return makeRecommendation({
      action: "ASSIGN_CASE_OWNER",
      explanation:
        "No case owner is recorded. Assign an authorized officer before case-specific follow-up.",
      facts: [...facts, "No assigned case owner is recorded."],
      urgency: risk.risk_level === "CRITICAL" ? "HIGH" : "MEDIUM",
      responsible_role: "ADMIN",
    });
  }

  if (!complaint.due_date) {
    return makeRecommendation({
      action: "SET_SLA_DEADLINE",
      explanation:
        "No due date is recorded, so deadline risk cannot be assessed. Set a valid deadline consistent with the applicable service rules.",
      facts,
      urgency: "MEDIUM",
      responsible_role: "BUREAU_OFFICER",
    });
  }

  if (risk.risk_level === "CRITICAL") {
    return makeRecommendation({
      action: "PRIORITIZE_IMMEDIATE_REVIEW",
      explanation:
        "The complaint is within the configured critical deadline window. Review progress now and decide the next operational step.",
      facts: [...facts, risk.explanation],
      urgency: "HIGH",
      responsible_role: "CASE_OWNER",
    });
  }

  if (risk.risk_level === "AT_RISK") {
    return makeRecommendation({
      action: "REVIEW_PROGRESS",
      explanation:
        "The complaint is approaching its deadline. Check progress and follow up with the responsible bureau if work is blocked.",
      facts: [...facts, risk.explanation],
      urgency: "MEDIUM",
      responsible_role: "CASE_OWNER",
    });
  }

  if (pendingOverlapCount > 0) {
    return makeRecommendation({
      action: "REVIEW_PENDING_RELATED_CASE",
      explanation:
        "A potential overlap is awaiting an official decision. Inspect its evidence before deciding whether the complaints are related.",
      facts: [...facts, `${pendingOverlapCount} pending overlap alert(s) involve this case.`],
      urgency: "LOW",
      responsible_role: "BUREAU_OFFICER",
    });
  }

  if (confirmedRelatedCount > 0) {
    return makeRecommendation({
      action: "CHECK_RELATED_CASE_PROGRESS",
      explanation:
        "An official has recorded related complaint links. Check their progress for relevant context without merging or changing either case.",
      facts: [...facts, `${confirmedRelatedCount} officially reviewed related case link(s) exist.`],
      urgency: "LOW",
      responsible_role: "CASE_OWNER",
    });
  }

  if (complaint.status === "RECEIVED" || complaint.status === "UNDER_REVIEW") {
    return makeRecommendation({
      action: "REVIEW_COMPLAINT_DETAILS",
      explanation:
        "The complaint has not progressed beyond intake/review. Verify the complaint details and supporting information before updating its status.",
      facts,
      urgency: "LOW",
      responsible_role: "CASE_OWNER",
    });
  }

  return makeRecommendation({
    action: "UPDATE_CASE_PROGRESS",
    explanation:
      "No deadline or workflow exception requires immediate action. Review the current work and record the next progress update.",
    facts: [...facts, `${history.length} case-history action(s) are recorded.`],
    urgency: "LOW",
    responsible_role: "CASE_OWNER",
  });
}
