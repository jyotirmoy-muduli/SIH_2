import { CLOSURE_RULES } from "../config/closureIntegrity.js";

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "been",
  "before",
  "being",
  "could",
  "from",
  "have",
  "into",
  "more",
  "other",
  "that",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "were",
  "which",
  "with",
  "would",
]);

function issueTerms(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.filter((word) => !STOP_WORDS.has(word)) || []
  );
}

function check(id, label, status, explanation, mandatory = false) {
  return { id, label, status, explanation, mandatory };
}

export function assessResolutionIntegrity(complaint, rules = CLOSURE_RULES) {
  const resolution = complaint.resolution;
  const response = resolution?.response?.trim() || "";
  const completedActions = (resolution?.completed_actions || [])
    .map((action) => String(action).trim())
    .filter(Boolean);
  const evidence = resolution?.evidence || [];
  const actions = complaint.actions || [];
  const evidenceCategoryRequired = rules.requiredEvidenceCategories.includes(
    String(complaint.complaint_type || "").trim().toLowerCase()
  );
  const checks = [];

  checks.push(
    check(
      "complaint_details",
      "Original complaint details",
      complaint.subject?.trim() && complaint.description?.trim() ? "PASS" : "FAIL",
      complaint.subject?.trim() && complaint.description?.trim()
        ? "The original subject and complaint description are present."
        : "A subject or original description is missing; review the source complaint.",
      true
    )
  );

  const responseRecorded =
    response.length >= rules.minimumResponseCharacters;
  checks.push(
    check(
      "resolution_response",
      "Resolution response recorded",
      responseRecorded ? "PASS" : "FAIL",
      responseRecorded
        ? `A ${response.length}-character response is recorded. This check does not verify that the remedy was effective.`
        : `Record a resolution response of at least ${rules.minimumResponseCharacters} characters.`,
      rules.responseRequired
    )
  );

  const originalTerms = issueTerms(
    `${complaint.subject || ""} ${complaint.description || ""}`
  );
  const responseTerms = issueTerms(response);
  const sharedTerms = [...originalTerms].filter((term) =>
    responseTerms.has(term)
  );
  checks.push(
    check(
      "response_issue_reference",
      "Response refers to the reported issue",
      sharedTerms.length ? "PASS" : "REVIEW",
      sharedTerms.length
        ? `The response shares issue terms (${sharedTerms.slice(0, 8).join(", ")}). This lexical check is not proof that the issue was resolved.`
        : "No clear shared issue terms were found; an official should confirm that the response addresses the reported complaint."
    )
  );

  checks.push(
    check(
      "completed_actions",
      "Resolution actions documented",
      completedActions.length ? "PASS" : "FAIL",
      completedActions.length
        ? `${completedActions.length} resolution action(s) are recorded.`
        : "Record the corrective or follow-up actions completed for this complaint.",
      rules.actionsRequired
    )
  );

  const evidenceStatus = evidence.length
    ? "REVIEW"
    : evidenceCategoryRequired
      ? "FAIL"
      : "REVIEW";
  checks.push(
    check(
      "supporting_evidence",
      "Supporting evidence",
      evidenceStatus,
      evidence.length
        ? `${evidence.length} evidence reference(s) are recorded; an official must inspect their relevance and authenticity.`
        : evidenceCategoryRequired
          ? `Evidence is required for complaint category "${complaint.complaint_type}". Add at least one evidence reference.`
          : "No evidence reference is recorded. Confirm whether evidence is needed for this case.",
      evidenceCategoryRequired
    )
  );

  const closedStatus = ["RESOLVED", "CLOSED"].includes(complaint.status);
  const hasResolutionTimestamp =
    complaint.resolved_at instanceof Date &&
    Number.isFinite(complaint.resolved_at.getTime());
  const hasResolutionHistory = actions.some(
    (action) =>
      ["RESOLVED", "CLOSED"].includes(action.new_status) &&
      action.created_at instanceof Date &&
      Number.isFinite(action.created_at.getTime())
  );
  checks.push(
    check(
      "resolution_status_history",
      "Resolution status and timestamp",
      !closedStatus ? "REVIEW" : hasResolutionTimestamp ? "PASS" : "FAIL",
      !closedStatus
        ? "The complaint is not marked resolved or closed yet."
        : hasResolutionTimestamp && hasResolutionHistory
          ? "A resolved/closed status, resolution timestamp, and matching status-history entry are present."
          : hasResolutionTimestamp
            ? "A resolution timestamp is present, but no matching resolved/closed history entry was found."
          : "The complaint is marked resolved or closed but has no resolution timestamp.",
      closedStatus && !hasResolutionTimestamp
    )
  );
  if (closedStatus && hasResolutionTimestamp && !hasResolutionHistory) {
    checks[checks.length - 1].status = "REVIEW";
  }

  const failedMandatoryChecks = checks.filter(
    (item) => item.mandatory && item.status === "FAIL"
  );
  const reviewRequired = checks.some((item) => item.status === "REVIEW");

  return {
    status:
      failedMandatoryChecks.length > 0
        ? "INCOMPLETE"
        : reviewRequired
          ? "REQUIRES_REVIEW"
          : "CHECKS_PASSED",
    checks,
    mandatory_failures: failedMandatoryChecks.map((item) => item.id),
    blocking_enabled: rules.blockingEnabled,
    can_block_closure:
      rules.blockingEnabled && failedMandatoryChecks.length > 0,
    disclaimer:
      "This checklist detects missing or inconsistent records. Passing checks does not prove that the complaint was genuinely resolved; an authorized official must assess the remedy and evidence.",
  };
}
