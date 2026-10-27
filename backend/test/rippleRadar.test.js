import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRippleClusters,
  identifyCategoryTrends,
  summarizeAdjustedIssue,
} from "../src/services/rippleRadar.js";

const now = new Date("2026-10-25T10:00:00.000Z");
const config = {
  timeWindowDays: 30,
  closeTimeDays: 7,
  minSimilarity: 42,
  minTextSimilarity: 15,
  minClusterSize: 3,
  maxCases: 500,
};

function complaint(id, overrides = {}) {
  return {
    _id: id,
    case_number: `GRV-${id}`,
    subject: "Delay in publishing final examination results",
    description:
      "The final examination results have not been published after the semester ended.",
    bureau_name: `Bureau ${id}`,
    complaint_type: "Examination",
    received_at: new Date("2026-10-20T10:00:00.000Z"),
    institution_id: {
      _id: `institution-${id}`,
      institution_name: `Institution ${id}`,
      permanent_id: `SAMPLE-${id}`,
    },
    ...overrides,
  };
}

test("groups textually similar complaints across institutions and bureaus", () => {
  const clusters = buildRippleClusters(
    [complaint("1"), complaint("2"), complaint("3")],
    config,
    now
  );

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].case_count, 3);
  assert.match(clusters[0].common_issue, /Potential shared issue/);
  assert.equal(clusters[0].status, "SUGGESTED");
  assert.ok(clusters[0].affected_bureaus.length === 3);
  assert.ok(clusters[0].affected_institutions.length === 3);
  assert.ok(clusters[0].cases.every((item) => item.similarity_score >= 42));
  assert.ok(
    clusters[0].cases.every((item) =>
      item.matching_reasons.includes("Shared description terms")
    )
  );
});

test("does not form a cluster from metadata matches without text similarity", () => {
  const unrelated = [
    complaint("a", {
      subject: "Hostel fee refund status",
      description: "The requested fee refund remains unpaid.",
      complaint_type: "Examination",
    }),
    complaint("b", {
      subject: "Examination hall access issue",
      description: "Students could not enter the assigned hall.",
      complaint_type: "Examination",
    }),
    complaint("c", {
      subject: "Library book replacement",
      description: "The institution has not replaced a damaged library book.",
      complaint_type: "Examination",
    }),
  ];

  assert.deepEqual(buildRippleClusters(unrelated, config, now), []);
});

test("respects the configured analysis time window", () => {
  const complaints = [
    complaint("recent-1"),
    complaint("recent-2"),
    complaint("old", {
      received_at: new Date("2026-09-20T10:00:00.000Z"),
    }),
  ];

  assert.deepEqual(buildRippleClusters(complaints, config, now), []);
});

test("requires the configured minimum number of related cases", () => {
  const result = buildRippleClusters(
    [complaint("one"), complaint("two")],
    config,
    now
  );

  assert.deepEqual(result, []);
});

test("reports only recurring categories whose recent count increased", () => {
  const trends = identifyCategoryTrends(
    [
      { category: "Examination", count: 18 },
      { category: "Hostel", count: 3 },
      { category: "Scholarship", count: 20 },
    ],
    [
      { category: "examination", count: 10 },
      { category: "Scholarship", count: 25 },
    ],
    3
  );

  assert.deepEqual(trends, [
    {
      category: "Examination",
      trend: "INCREASED",
      previous_count: 10,
      current_count: 18,
      increase_count: 8,
      change_percent: 80,
    },
    {
      category: "Hostel",
      trend: "NEWLY_RECURRING",
      previous_count: 0,
      current_count: 3,
      increase_count: 3,
      change_percent: null,
    },
  ]);
});

test("rebuilds the potential issue description from adjusted member subjects", () => {
  const summary = summarizeAdjustedIssue([
    { subject: "Delayed examination result" },
    { subject: "Examination result not published" },
    { subject: "Examination result correction" },
  ]);

  assert.match(summary, /Potential shared subject wording/);
  assert.match(summary, /examination/);
});
