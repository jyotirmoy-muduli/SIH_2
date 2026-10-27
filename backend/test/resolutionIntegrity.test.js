import test from "node:test";
import assert from "node:assert/strict";
import { assessResolutionIntegrity } from "../src/services/resolutionIntegrity.js";

const rules = {
  responseRequired: true,
  actionsRequired: true,
  blockingEnabled: false,
  requiredEvidenceCategories: ["examination"],
  minimumResponseCharacters: 20,
};

function resolvedCase(overrides = {}) {
  const resolvedAt = new Date("2026-10-25T10:00:00.000Z");
  return {
    subject: "Incorrect examination result",
    description: "The final examination result shows incorrect marks.",
    complaint_type: "Examination",
    status: "RESOLVED",
    resolved_at: resolvedAt,
    actions: [{ new_status: "RESOLVED", created_at: resolvedAt }],
    ...overrides,
  };
}

test("flags missing response, actions, and required evidence without blocking by default", () => {
  const result = assessResolutionIntegrity(resolvedCase(), rules);

  assert.equal(result.status, "INCOMPLETE");
  assert.equal(result.can_block_closure, false);
  assert.deepEqual(result.mandatory_failures, [
    "resolution_response",
    "completed_actions",
    "supporting_evidence",
  ]);
});

test("labels evidence references for official verification rather than claiming proof", () => {
  const result = assessResolutionIntegrity(
    resolvedCase({
      resolution: {
        response:
          "The examination result was checked and corrected after mark verification.",
        completed_actions: ["Verified the marks", "Issued a corrected result"],
        evidence: [{ label: "Correction order", reference: "CASE-REF-1" }],
      },
    }),
    rules
  );

  assert.equal(result.status, "REQUIRES_REVIEW");
  assert.equal(result.checks.find((item) => item.id === "resolution_response").status, "PASS");
  assert.equal(result.checks.find((item) => item.id === "response_issue_reference").status, "PASS");
  assert.equal(result.checks.find((item) => item.id === "supporting_evidence").status, "REVIEW");
  assert.match(result.disclaimer, /does not prove/i);
});

test("requires human review when the response has no shared issue terms", () => {
  const result = assessResolutionIntegrity(
    resolvedCase({
      resolution: {
        response: "Your institution request has been processed and filed.",
        completed_actions: ["Reviewed the submission"],
        evidence: [],
      },
    }),
    rules
  );

  assert.equal(result.checks.find((item) => item.id === "response_issue_reference").status, "REVIEW");
});

test("reports inconsistent resolution timestamp and history", () => {
  const result = assessResolutionIntegrity(
    resolvedCase({
      resolved_at: null,
      actions: [],
    }),
    rules
  );

  assert.equal(result.checks.find((item) => item.id === "resolution_status_history").status, "FAIL");
  assert.ok(result.mandatory_failures.includes("resolution_status_history"));
});

test("does not apply closed-case checks to active complaints", () => {
  const result = assessResolutionIntegrity(
    resolvedCase({ status: "IN_PROGRESS", resolved_at: null }),
    rules
  );

  assert.equal(result.checks.find((item) => item.id === "resolution_status_history").status, "REVIEW");
});

test("allows explicitly configured mandatory requirements to block closure", () => {
  const result = assessResolutionIntegrity(
    resolvedCase(),
    { ...rules, blockingEnabled: true }
  );

  assert.equal(result.can_block_closure, true);
});
