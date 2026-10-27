import ComplaintCase from "../models/ComplaintCase.js";
import OverlapAlert from "../models/OverlapAlert.js";

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "in", "on",
  "at", "to", "of", "for", "and", "or", "by", "with", "from",
  "this", "that", "it", "has", "have", "had", "be", "been",
  "their", "they", "them", "students", "student", "institution",
  "regarding", "report", "reports", "complaint", "complaints"
]);

function normalizeToken(token) {
  let word = token.toLowerCase();

  if (word.length > 5 && word.endsWith("ies")) {
    word = `${word.slice(0, -3)}y`;
  } else if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) {
    word = word.slice(0, -1);
  }

  return word;
}

export function tokenize(text = "") {
  return new Set(
    text
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(normalizeToken)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  );
}

export function jaccardSimilarity(first, second) {
  if (!first.size || !second.size) return { score: 0, terms: [] };

  const intersection = [...first].filter((word) => second.has(word));
  const union = new Set([...first, ...second]);
  return { score: intersection.length / union.size, terms: intersection };
}

function compareCases(first, second) {
  const subjectMatch = jaccardSimilarity(
    tokenize(first.subject),
    tokenize(second.subject)
  );
  const descriptionMatch = jaccardSimilarity(
    tokenize(first.description),
    tokenize(second.description)
  );
  const score = Math.round(
    (0.7 * subjectMatch.score + 0.3 * descriptionMatch.score) * 100
  );
  const matchingTerms = [
    ...new Set([...subjectMatch.terms, ...descriptionMatch.terms]),
  ];
  const reasons = [];

  if (subjectMatch.score > 0) reasons.push("Similar subject wording");
  if (descriptionMatch.score > 0) reasons.push("Shared description terms");
  reasons.push("Same institution, different bureaus");

  return { score, matchingTerms, reasons };
}

export async function detectOverlaps() {
  const cases = await ComplaintCase.find({ status: { $ne: "CLOSED" } })
    .select("case_number institution_id subject description bureau_name status")
    .sort({ institution_id: 1, _id: 1 })
    .lean();
  const groups = new Map();

  for (const item of cases) {
    const institutionId = item.institution_id.toString();
    if (!groups.has(institutionId)) groups.set(institutionId, []);
    groups.get(institutionId).push(item);
  }

  const candidates = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const first = group[i];
        const second = group[j];
        if (first.bureau_name === second.bureau_name) continue;

        const comparison = compareCases(first, second);
        if (comparison.score < 15) continue;
        candidates.push({ first, second, ...comparison });
      }
    }
  }

  for (const candidate of candidates) {
    const { first, second, score, matchingTerms, reasons } = candidate;
    const [lowId, highId] = [first._id, second._id].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );
    const reason = JSON.stringify({
      explanation: reasons,
      matching_terms: matchingTerms,
      algorithm: "weighted_jaccard_v1",
    });
    const existing = await OverlapAlert.findOne({
      case_id: lowId,
      related_case_id: highId,
    });

    if (existing?.status === "PENDING") {
      existing.alert_reason = reason;
      existing.confidence_score = score;
      await existing.save();
    } else if (!existing) {
      try {
        await OverlapAlert.create({
          case_id: lowId,
          related_case_id: highId,
          alert_reason: reason,
          confidence_score: score,
          status: "PENDING",
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
  }

  return {
    cases_scanned: cases.length,
    candidates_found: candidates.length,
    candidates: candidates.map((item) => ({
      case_number: item.first.case_number,
      related_case_number: item.second.case_number,
      institution_id: item.first.institution_id.toString(),
      bureau_a: item.first.bureau_name,
      bureau_b: item.second.bureau_name,
      similarity_score: item.score,
      matching_terms: item.matchingTerms,
      reasons: item.reasons,
    })),
  };
}
