import test from "node:test";
import assert from "node:assert/strict";
import { recommendNextAction } from "../src/services/nextActionService.js";

const now = new Date("2026-10-25T10:00:00.000Z");

function activeCase(overrides = {}) {
  return {
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    description: "The examination result contains incorrect marks.",
    due_date: new Date("2026-10-30T10:00:00.000Z"),
    assigned_to: { full_name: "Case Officer" },
    actions: [],
    ...overrides,
  };
}

test("recommends supervisor review for an overdue active case", () => {
  const result = recommendNextAction(
    activeCase({ due_date: new Date("2026-10-24T10:00:00.000Z") }),
    { now }
  );

  assert.equal(result.action, "ESCALATE_OVERDUE_CASE");
  assert.equal(result.urgency, "CRITICAL");
  assert.match(result.explanation, /deadline has passed/i);
});

test("recommends follow-up when a case is awaiting a response", () => {
  const result = recommendNextAction(
    activeCase({
      status: "AWAITING_RESPONSE",
      actions: [
        { action_type: "STATUS_CHANGED", new_status: "AWAITING_RESPONSE" },
      ],
    }),
    { now }
  );

  assert.equal(result.action, "FOLLOW_UP_ON_RESPONSE");
  assert.ok(result.supporting_facts.some((fact) => /1 transition/.test(fact)));
});

test("prioritizes assigning an owner before other routine work", () => {
  const result = recommendNextAction(activeCase({ assigned_to: null }), { now });

  assert.equal(result.action, "ASSIGN_CASE_OWNER");
  assert.equal(result.suggested_responsible_role, "ADMIN");
});

test("recommends setting a deadline when an owner exists but no deadline is recorded", () => {
  const result = recommendNextAction(activeCase({ due_date: null }), { now });

  assert.equal(result.action, "SET_SLA_DEADLINE");
  assert.ok(result.supporting_facts.includes("No deadline is recorded."));
});

test("routes resolved cases with incomplete resolution details for review", () => {
  const result = recommendNextAction(
    activeCase({
      status: "RESOLVED",
      resolved_at: now,
      resolution: { response: "", completed_actions: [], evidence: [] },
    }),
    { now }
  );

  assert.equal(result.action, "REVIEW_RESOLUTION_RECORD");
  assert.match(result.explanation, /checklist/i);
});

test("uses reviewed relationships only as non-merging context", () => {
  const pending = recommendNextAction(activeCase(), {
    now,
    pendingOverlapCount: 1,
  });
  const confirmed = recommendNextAction(activeCase(), {
    now,
    confirmedRelatedCount: 2,
  });

  assert.equal(pending.action, "REVIEW_PENDING_RELATED_CASE");
  assert.equal(confirmed.action, "CHECK_RELATED_CASE_PROGRESS");
  assert.match(confirmed.explanation, /without merging/i);
});

test("does not recommend operational work for a closed case", () => {
  const result = recommendNextAction(activeCase({ status: "CLOSED" }), { now });

  assert.equal(result.action, "NO_ACTION_REQUIRED");
  assert.equal(result.urgency, "NONE");
});

test("explains safe fallback when required complaint information is missing", () => {
  const result = recommendNextAction(
    activeCase({ description: "" }),
    { now }
  );

  assert.equal(result.action, "REQUEST_MISSING_INFORMATION");
  assert.match(result.explanation, /description is missing/i);
  assert.ok(result.supporting_facts.length > 0);
});
