
import pool from "../config/db.js";

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "in", "on",
  "at", "to", "of", "for", "and", "or", "by", "with", "from",
  "this", "that", "it", "has", "have", "had", "be", "been",
  "their", "they", "them", "students", "student", "institution",
  "regarding", "report", "reports", "complaint", "complaints"
]);

function normalizeToken(token) {
  let word = token.toLowerCase();

  // Small deterministic normalization for the prototype.
  if (word.length > 5 && word.endsWith("ies")) {
    word = `${word.slice(0, -3)}y`;
  } else if (
    word.length > 4 &&
    word.endsWith("s") &&
    !word.endsWith("ss")
  ) {
    word = word.slice(0, -1);
  }

  return word;
}

function tokenize(text = "") {
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

function jaccardSimilarity(first, second) {
  if (!first.size || !second.size) return 0;

  const intersection = [...first].filter((word) => second.has(word));
  const union = new Set([...first, ...second]);

  return {
    score: intersection.length / union.size,
    terms: intersection
  };
}

function compareCases(first, second) {
  const firstSubject = tokenize(first.subject);
  const secondSubject = tokenize(second.subject);

  const firstDescription = tokenize(first.description);
  const secondDescription = tokenize(second.description);

  const subjectMatch = jaccardSimilarity(firstSubject, secondSubject);
  const descriptionMatch = jaccardSimilarity(
    firstDescription,
    secondDescription
  );

  // Subject similarity carries more weight than description similarity.
  const score = Math.round(
    (0.7 * subjectMatch.score + 0.3 * descriptionMatch.score) * 100
  );

  const matchingTerms = [
    ...new Set([
      ...subjectMatch.terms,
      ...descriptionMatch.terms
    ])
  ];

  const reasons = [];

  if (subjectMatch.score > 0) {
    reasons.push("Similar subject wording");
  }

  if (descriptionMatch.score > 0) {
    reasons.push("Shared description terms");
  }

  reasons.push("Same institution, different bureaus");

  return {
    score,
    matchingTerms,
    reasons
  };
}

export async function detectOverlaps() {
  const [cases] = await pool.execute(`
    SELECT
      id, case_number, institution_id, subject, description,
      bureau_name, status
    FROM complaint_cases
    WHERE status NOT IN ('CLOSED')
    ORDER BY institution_id, id
  `);

  const groups = new Map();

  for (const item of cases) {
    if (!groups.has(item.institution_id)) {
      groups.set(item.institution_id, []);
    }

    groups.get(item.institution_id).push(item);
  }

  const candidates = [];

  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const first = group[i];
        const second = group[j];

        if (first.bureau_name === second.bureau_name) continue;

        const comparison = compareCases(first, second);

        // A transparent prototype threshold; tune using reviewed examples.
        if (comparison.score < 15) continue;

        candidates.push({
          first,
          second,
          ...comparison
        });
      }
    }
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const candidate of candidates) {
      const { first, second, score, matchingTerms, reasons } = candidate;

      const reason = JSON.stringify({
        explanation: reasons,
        matching_terms: matchingTerms,
        algorithm: "weighted_jaccard_v1"
      });

      // Store each pair in a consistent order to avoid reversed duplicates.
      const lowId = Math.min(first.id, second.id);
      const highId = Math.max(first.id, second.id);

      const [existing] = await connection.execute(
        `SELECT id, status
         FROM overlap_alerts
         WHERE case_id = ? AND related_case_id = ?
         LIMIT 1`,
        [lowId, highId]
      );

      if (existing.length) {
        // Preserve decisions already made by an officer.
        if (existing[0].status === "PENDING") {
          await connection.execute(
            `UPDATE overlap_alerts
             SET alert_reason = ?, confidence_score = ?
             WHERE id = ?`,
            [reason, score, existing[0].id]
          );
        }
      } else {
        await connection.execute(
          `INSERT INTO overlap_alerts
           (case_id, related_case_id, alert_reason,
            confidence_score, status)
           VALUES (?, ?, ?, ?, 'PENDING')`,
          [lowId, highId, reason, score]
        );
      }
    }

    await connection.commit();

    return {
      cases_scanned: cases.length,
      candidates_found: candidates.length,
      candidates: candidates.map((item) => ({
        case_number: item.first.case_number,
        related_case_number: item.second.case_number,
        institution_id: item.first.institution_id,
        bureau_a: item.first.bureau_name,
        bureau_b: item.second.bureau_name,
        similarity_score: item.score,
        matching_terms: item.matchingTerms,
        reasons: item.reasons
      }))
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
