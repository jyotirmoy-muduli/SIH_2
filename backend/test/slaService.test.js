import test from "node:test";
import assert from "node:assert/strict";
import { calculateSlaRisk } from "../src/services/slaService.js";

const now = new Date("2026-10-27T12:00:00.000Z");
const inHours = (hours) => new Date(now.getTime() + hours * 60 * 60 * 1000);

function complaint(overrides = {}) {
  return {
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    due_date: inHours(120),
    ...overrides,
  };
}

test("classifies overdue, critical, at-risk, and on-track deadlines", () => {
  assert.equal(calculateSlaRisk(complaint({ due_date: inHours(-3) }), now).risk_level, "OVERDUE");
  assert.equal(calculateSlaRisk(complaint({ due_date: inHours(12) }), now).risk_level, "CRITICAL");
  assert.equal(calculateSlaRisk(complaint({ due_date: inHours(48) }), now).risk_level, "AT_RISK");
  assert.equal(calculateSlaRisk(complaint({ due_date: inHours(96) }), now).risk_level, "ON_TRACK");
});

test("raises urgent risk without falsely marking a future deadline overdue", () => {
  const result = calculateSlaRisk(
    complaint({ priority: "URGENT", due_date: inHours(96) }),
    now
  );

  assert.equal(result.risk_level, "AT_RISK");
  assert.equal(result.escalation_required, true);
});

test("excludes resolved cases and explains missing or invalid dates", () => {
  assert.equal(
    calculateSlaRisk(complaint({ status: "RESOLVED", due_date: inHours(-1) }), now).risk_level,
    "COMPLETED"
  );
  assert.equal(calculateSlaRisk(complaint({ due_date: null }), now).risk_level, "NO_DEADLINE");
  assert.equal(calculateSlaRisk(complaint({ due_date: "invalid" }), now).risk_level, "INVALID_DEADLINE");
  assert.ok(calculateSlaRisk(complaint({ due_date: null }), now).explanation);
});

test("applies injected configurable thresholds", () => {
  const result = calculateSlaRisk(complaint({ due_date: inHours(24) }), now, {
    criticalHours: 12,
    atRiskHours: 36,
  });

  assert.equal(result.risk_level, "AT_RISK");
});
