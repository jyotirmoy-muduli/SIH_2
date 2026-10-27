import { createHash } from "node:crypto";
import { RIPPLE_RADAR_CONFIG } from "../config/rippleRadar.js";
import { jaccardSimilarity, tokenize } from "./overlapDetection.js";

const ALGORITHM_VERSION = "metadata_weighted_jaccard_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

function caseId(record) {
  return String(record._id || record.id);
}

function sameValue(first, second) {
  return Boolean(first) && Boolean(second) && String(first) === String(second);
}

function prepareCase(complaint) {
  const subjectTokens = tokenize(complaint.subject || "");
  const descriptionTokens = tokenize(complaint.description || "");
  return {
    complaint,
    id: caseId(complaint),
    receivedAt: new Date(complaint.received_at).getTime(),
    subjectTokens,
    descriptionTokens,
    completeTextTokens: new Set([...subjectTokens, ...descriptionTokens]),
    institutionId: complaint.institution_id?._id || complaint.institution_id,
    category:
      typeof complaint.complaint_type === "string"
        ? complaint.complaint_type.trim().toLowerCase()
        : "",
  };
}

function compareCases(first, second, config) {
  const subjectMatch = jaccardSimilarity(
    first.subjectTokens,
    second.subjectTokens
  );
  const descriptionMatch = jaccardSimilarity(
    first.descriptionTokens,
    second.descriptionTokens
  );
  const completeTextMatch = jaccardSimilarity(
    first.completeTextTokens,
    second.completeTextTokens
  );
  const sameInstitution = sameValue(first.institutionId, second.institutionId);
  const sameBureau = sameValue(
    first.complaint.bureau_name,
    second.complaint.bureau_name
  );
  const sameCategory =
    first.category !== "" && first.category === second.category;
  const daysApart = Math.abs(first.receivedAt - second.receivedAt) / DAY_MS;
  const closeInTime =
    Number.isFinite(daysApart) && daysApart <= config.closeTimeDays;

  if (
    completeTextMatch.score < config.minTextSimilarity / 100 ||
    !Number.isFinite(daysApart) ||
    daysApart > config.timeWindowDays
  ) {
    return null;
  }

  const score = Math.round(
    completeTextMatch.score * 68 +
      (sameInstitution ? 10 : 0) +
      (sameBureau ? 5 : 0) +
      (sameCategory ? 10 : 0) +
      (closeInTime ? 7 : 3)
  );
  if (score < config.minSimilarity) return null;

  const reasons = [];
  if (subjectMatch.score > 0) reasons.push("Similar subject wording");
  if (descriptionMatch.score > 0) reasons.push("Shared description terms");
  if (sameInstitution) reasons.push("Same institution");
  if (sameBureau) reasons.push("Same bureau/cell");
  if (sameCategory) reasons.push("Same complaint category");
  reasons.push(
    closeInTime
      ? `Received within ${config.closeTimeDays} days`
      : `Within the ${config.timeWindowDays}-day analysis window`
  );

  return {
    score: Math.min(score, 100),
    reasons,
    matchingTerms: [
      ...new Set([
        ...subjectMatch.terms,
        ...descriptionMatch.terms,
        ...completeTextMatch.terms,
      ]),
    ],
  };
}

function commonIssue(cases) {
  const commonTerms = findCommonTerms(
    cases,
    (complaint) =>
      `${complaint.subject || ""} ${complaint.description || ""}`
  );

  if (commonTerms.length) return `Potential shared issue: ${commonTerms.join(", ")}`;

  const categories = [
    ...new Set(
      cases
        .map(({ complaint_type }) => complaint_type?.trim())
        .filter(Boolean)
    ),
  ];
  return categories.length
    ? `Potential pattern in ${categories.join(", ")} complaints`
    : "Potentially related complaint pattern";
}

function findCommonTerms(records, getText) {
  const frequencies = new Map();
  for (const record of records) {
    for (const term of tokenize(getText(record))) {
      frequencies.set(term, (frequencies.get(term) || 0) + 1);
    }
  }
  return [...frequencies.entries()]
    .filter(([, frequency]) => frequency >= Math.ceil(records.length / 2))
    .sort(
      (first, second) =>
        second[1] - first[1] || first[0].localeCompare(second[0])
    )
    .slice(0, 5)
    .map(([term]) => term);
}

export function summarizeAdjustedIssue(members) {
  const commonTerms = findCommonTerms(members, (member) => member.subject || "");

  return commonTerms.length
    ? `Potential shared subject wording: ${commonTerms.join(", ")}`
    : "Potential pattern after official grouping adjustment";
}

function memberRecord(complaint, evidence) {
  const institution = complaint.institution_id;
  return {
    case_id: caseId(complaint),
    case_number: complaint.case_number,
    subject: complaint.subject,
    bureau_name: complaint.bureau_name,
    institution_id: institution?._id || institution || null,
    institution_name: institution?.institution_name || null,
    permanent_id: institution?.permanent_id || null,
    received_at: complaint.received_at,
    similarity_score: evidence.score,
    matching_reasons: [...evidence.reasons],
    matching_terms: [...evidence.matchingTerms],
    matched_case_numbers: [...evidence.matchedCaseNumbers],
  };
}

export function buildRippleClusters(
  complaints,
  config = RIPPLE_RADAR_CONFIG,
  now = new Date()
) {
  const cutoff = now.getTime() - config.timeWindowDays * DAY_MS;
  const recentCases = complaints
    .map(prepareCase)
    .filter(
      ({ receivedAt }) =>
        Number.isFinite(receivedAt) &&
        receivedAt >= cutoff &&
        receivedAt <= now.getTime()
    );
  const adjacency = new Map(recentCases.map(({ id }) => [id, []]));
  const evidenceByMember = new Map();

  for (let firstIndex = 0; firstIndex < recentCases.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < recentCases.length;
      secondIndex += 1
    ) {
      const first = recentCases[firstIndex];
      const second = recentCases[secondIndex];
      const comparison = compareCases(first, second, config);
      if (!comparison) continue;

      const firstId = first.id;
      const secondId = second.id;
      adjacency.get(firstId).push(secondId);
      adjacency.get(secondId).push(firstId);
      for (const [memberId, relatedId] of [
        [firstId, secondId],
        [secondId, firstId],
      ]) {
        const evidence = evidenceByMember.get(memberId) || {
          score: 0,
          reasons: new Set(),
          matchingTerms: new Set(),
          relatedIds: new Set(),
        };
        if (comparison.score > evidence.score) {
          evidence.score = comparison.score;
          evidence.reasons.clear();
          evidence.matchingTerms.clear();
          evidence.relatedIds.clear();
        }
        if (comparison.score === evidence.score) {
          comparison.reasons.forEach((reason) => evidence.reasons.add(reason));
          comparison.matchingTerms.forEach((term) =>
            evidence.matchingTerms.add(term)
          );
          evidence.relatedIds.add(relatedId);
        }
        evidenceByMember.set(memberId, evidence);
      }
    }
  }

  const caseById = new Map(
    recentCases.map(({ id, complaint }) => [id, complaint])
  );
  const visited = new Set();
  const clusters = [];

  for (const { id: initialId } of recentCases) {
    if (visited.has(initialId)) continue;

    const pending = [initialId];
    const componentIds = [];
    visited.add(initialId);
    while (pending.length) {
      const currentId = pending.pop();
      componentIds.push(currentId);
      for (const relatedId of adjacency.get(currentId)) {
        if (visited.has(relatedId)) continue;
        visited.add(relatedId);
        pending.push(relatedId);
      }
    }
    if (componentIds.length < config.minClusterSize) continue;

    const component = componentIds.map((id) => caseById.get(id));
    const memberEvidence = componentIds.map((id) => {
      const evidence = evidenceByMember.get(id);
      return memberRecord(caseById.get(id), {
        score: evidence.score,
        reasons: [...evidence.reasons].sort(),
        matchingTerms: [...evidence.matchingTerms].sort(),
        matchedCaseNumbers: [...evidence.relatedIds]
          .map((relatedId) => caseById.get(relatedId)?.case_number)
          .filter(Boolean)
          .sort(),
      });
    });
    const dates = component
      .map(({ received_at }) => new Date(received_at))
      .sort((first, second) => first - second);
    const affectedInstitutions = [
      ...new Set(
        component
          .map(({ institution_id: institution }) => institution?.institution_name)
          .filter(Boolean)
      ),
    ];
    const affectedBureaus = [
      ...new Set(component.map(({ bureau_name }) => bureau_name).filter(Boolean)),
    ];
    const matchingReasons = [
      ...new Set(memberEvidence.flatMap(({ matching_reasons }) => matching_reasons)),
    ].sort();
    const caseIds = memberEvidence
      .map(({ case_id }) => case_id)
      .sort();
    const clusterKey = createHash("sha256").update(caseIds.join(":")).digest("hex");

    clusters.push({
      cluster_key: clusterKey,
      source_case_ids: caseIds,
      status: "SUGGESTED",
      common_issue: commonIssue(component),
      case_count: component.length,
      affected_institutions: affectedInstitutions,
      affected_bureaus: affectedBureaus,
      period_start: dates[0],
      period_end: dates.at(-1),
      matching_reasons: matchingReasons,
      algorithm: ALGORITHM_VERSION,
      cases: memberEvidence,
      generated_at: now,
    });
  }

  return clusters;
}

export function identifyCategoryTrends(
  currentCounts,
  previousCounts,
  minimumCurrentCount = RIPPLE_RADAR_CONFIG.minClusterSize
) {
  const previous = new Map();
  for (const { category, count } of previousCounts) {
    const key = category.trim().toLowerCase();
    previous.set(key, (previous.get(key) || 0) + count);
  }
  const mergedCurrent = new Map();
  for (const { category, count } of currentCounts) {
    const key = category.trim().toLowerCase();
    const existing = mergedCurrent.get(key);
    if (existing) existing.current_count += count;
    else mergedCurrent.set(key, { category: category.trim(), current_count: count });
  }

  return [...mergedCurrent.entries()]
    .map(([key, item]) => {
      const previousCount = previous.get(key) || 0;
      if (
        item.current_count < minimumCurrentCount ||
        item.current_count <= previousCount
      ) {
        return null;
      }
      return {
        category: item.category,
        trend: previousCount === 0 ? "NEWLY_RECURRING" : "INCREASED",
        previous_count: previousCount,
        current_count: item.current_count,
        increase_count: item.current_count - previousCount,
        change_percent:
          previousCount === 0
            ? null
            : Math.round(
                ((item.current_count - previousCount) / previousCount) * 100
              ),
      };
    })
    .filter(Boolean)
    .sort(
      (first, second) =>
        second.increase_count - first.increase_count ||
        first.category.localeCompare(second.category)
    );
}

export { ALGORITHM_VERSION };
