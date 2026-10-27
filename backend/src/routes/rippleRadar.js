import express from "express";
import mongoose from "mongoose";
import ComplaintCase from "../models/ComplaintCase.js";
import RippleCluster from "../models/RippleCluster.js";
import "../models/User.js";
import { RIPPLE_RADAR_CONFIG } from "../config/rippleRadar.js";
import { requireRoles } from "../middleware/auth.js";
import {
  buildRippleClusters,
  identifyCategoryTrends,
  summarizeAdjustedIssue,
} from "../services/rippleRadar.js";

const router = express.Router();
const allowedStatuses = ["SUGGESTED", "CONFIRMED", "DISMISSED", "ADJUSTED", "ALL"];
const allowedDecisions = ["CONFIRMED", "DISMISSED", "ADJUSTED"];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clusterDto(cluster, user) {
  const record = cluster.toObject ? cluster.toObject() : cluster;
  const allCases = record.cases || [];
  const visibleCases =
    user.role === "BUREAU_OFFICER"
      ? allCases.filter(({ bureau_name }) => bureau_name === user.bureau_name)
      : allCases;
  const visibleCaseIds = new Set(visibleCases.map(({ case_id }) => String(case_id)));

  return {
    id: String(record._id),
    status: record.status,
    common_issue: record.common_issue,
    case_count: record.case_count,
    visible_case_count: visibleCases.length,
    affected_institutions: record.affected_institutions,
    affected_bureaus: record.affected_bureaus,
    period_start: record.period_start,
    period_end: record.period_end,
    matching_reasons: record.matching_reasons,
    algorithm: record.algorithm,
    generated_at: record.generated_at,
    updated_at: record.updated_at,
    cases: visibleCases.map((item) => ({
      ...item,
      case_id: String(item.case_id),
      institution_id: item.institution_id ? String(item.institution_id) : null,
    })),
    review_history: (record.review_history || []).map((review) => ({
      ...review,
      reviewer_id: String(review.reviewed_by?._id || review.reviewed_by),
      reviewer_name: review.reviewed_by?.full_name || null,
      notes:
        user.role === "BUREAU_OFFICER" && visibleCases.length < allCases.length
          ? ""
          : review.notes,
      case_ids_before:
        user.role === "BUREAU_OFFICER"
          ? (review.case_ids_before || []).filter((id) =>
              visibleCaseIds.has(String(id))
            )
          : review.case_ids_before,
      case_ids_after:
        user.role === "BUREAU_OFFICER"
          ? (review.case_ids_after || []).filter((id) =>
              visibleCaseIds.has(String(id))
            )
          : review.case_ids_after,
    })),
  };
}

function shareClusterMembers(first, second) {
  const firstIds = new Set(first.source_case_ids.map(String));
  const secondIds = new Set(second.source_case_ids.map(String));
  const smallerSetSize = Math.min(firstIds.size, secondIds.size);
  if (!smallerSetSize) return false;
  let overlap = 0;
  for (const id of firstIds) {
    if (secondIds.has(id)) overlap += 1;
  }
  return overlap / smallerSetSize >= 0.66;
}

async function categoryCounts(start, end, user) {
  const match = {
    received_at: { $gte: start, $lt: end },
    complaint_type: { $type: "string", $nin: [""] },
  };
  if (user.role === "BUREAU_OFFICER") {
    match.bureau_name = user.bureau_name;
  }
  return ComplaintCase.aggregate([
    { $match: match },
    { $group: { _id: "$complaint_type", count: { $sum: 1 } } },
    { $project: { _id: 0, category: "$_id", count: 1 } },
    { $sort: { count: -1 } },
    { $limit: 100 },
  ]);
}

router.post("/scan", requireRoles("ADMIN"), async (_req, res) => {
  const now = new Date();
  const cutoff = new Date(
    now.getTime() - RIPPLE_RADAR_CONFIG.timeWindowDays * 24 * 60 * 60 * 1000
  );

  try {
    const complaints = await ComplaintCase.find({
      received_at: { $gte: cutoff, $lte: now },
      status: { $ne: "CLOSED" },
    })
      .select(
        "case_number subject description bureau_name complaint_type received_at institution_id status"
      )
      .populate("institution_id", "permanent_id institution_name")
      .sort({ received_at: -1 })
      .limit(RIPPLE_RADAR_CONFIG.maxCases)
      .lean();
    const suggestions = buildRippleClusters(
      complaints,
      RIPPLE_RADAR_CONFIG,
      now
    );
    const complaintIds = complaints.map(({ _id }) => _id);
    const existing = complaintIds.length
      ? await RippleCluster.find({
          $or: [
            { source_case_ids: { $in: complaintIds } },
            { "cases.case_id": { $in: complaintIds } },
          ],
        })
          .select("cluster_key status source_case_ids")
          .lean()
      : [];
    let created = 0;
    let duplicates = 0;

    for (const suggestion of suggestions) {
      const duplicate = existing.some(
        (cluster) =>
          cluster.cluster_key === suggestion.cluster_key ||
          shareClusterMembers(cluster, suggestion)
      );
      if (duplicate) {
        duplicates += 1;
        continue;
      }

      try {
        await RippleCluster.create(suggestion);
        created += 1;
      } catch (error) {
        if (error.code === 11000) {
          duplicates += 1;
          continue;
        }
        throw error;
      }
    }

    return res.json({
      success: true,
      message: "Ripple Radar scan completed",
      data: {
        cases_scanned: complaints.length,
        time_window_days: RIPPLE_RADAR_CONFIG.timeWindowDays,
        similarity_threshold: RIPPLE_RADAR_CONFIG.minSimilarity,
        min_text_similarity: RIPPLE_RADAR_CONFIG.minTextSimilarity,
        min_cluster_size: RIPPLE_RADAR_CONFIG.minClusterSize,
        potential_clusters_found: suggestions.length,
        clusters_created: created,
        duplicate_clusters_skipped: duplicates,
      },
    });
  } catch (error) {
    console.error("Ripple Radar scan:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not run Ripple Radar scan",
    });
  }
});

router.get("/", async (req, res) => {
  const status = String(req.query.status || "SUGGESTED");
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid Ripple Radar status",
    });
  }

  try {
    const filter = status === "ALL" ? {} : { status };
    if (req.user.role === "BUREAU_OFFICER") {
      filter["cases.bureau_name"] = req.user.bureau_name;
    }
    const now = new Date();
    const windowMilliseconds =
      RIPPLE_RADAR_CONFIG.timeWindowDays * 24 * 60 * 60 * 1000;
    const currentStart = new Date(now.getTime() - windowMilliseconds);
    const previousStart = new Date(now.getTime() - windowMilliseconds * 2);
    const [clusters, currentCounts, previousCounts] = await Promise.all([
      RippleCluster.find(filter)
        .populate("review_history.reviewed_by", "full_name")
        .sort({ generated_at: -1, created_at: -1 })
        .limit(200)
        .lean(),
      categoryCounts(currentStart, now, req.user),
      categoryCounts(previousStart, currentStart, req.user),
    ]);
    const data = clusters.map((cluster) => clusterDto(cluster, req.user));
    const categoryTrends = identifyCategoryTrends(
      currentCounts,
      previousCounts,
      RIPPLE_RADAR_CONFIG.minClusterSize
    );
    return res.json({
      success: true,
      count: data.length,
      data,
      category_trends: categoryTrends,
      trend_window_days: RIPPLE_RADAR_CONFIG.timeWindowDays,
    });
  } catch (error) {
    console.error("Fetch Ripple Radar clusters:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch Ripple Radar clusters",
    });
  }
});

router.get("/:id/candidates", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (
    !mongoose.isObjectIdOrHexString(req.params.id) ||
    search.length < 2 ||
    search.length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid cluster ID and a search term of 2 to 100 characters",
    });
  }

  try {
    const cluster = await RippleCluster.findById(req.params.id).select(
      "cases.case_id cases.bureau_name"
    );
    if (!cluster) {
      return res.status(404).json({
        success: false,
        message: "Ripple Radar cluster not found",
      });
    }
    if (
      req.user.role === "BUREAU_OFFICER" &&
      !cluster.cases.some(({ bureau_name }) => bureau_name === req.user.bureau_name)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can search candidates only for clusters visible to your bureau",
      });
    }

    const now = new Date();
    const cutoff = new Date(
      now.getTime() - RIPPLE_RADAR_CONFIG.timeWindowDays * 24 * 60 * 60 * 1000
    );
    const expression = new RegExp(escapeRegex(search), "i");
    const filter = {
      _id: { $nin: cluster.cases.map(({ case_id }) => case_id) },
      received_at: { $gte: cutoff, $lte: now },
      status: { $ne: "CLOSED" },
      $or: [{ case_number: expression }, { subject: expression }],
    };
    if (req.user.role === "BUREAU_OFFICER") {
      filter.bureau_name = req.user.bureau_name;
    }
    const candidates = await ComplaintCase.find(filter)
      .select("case_number subject bureau_name received_at institution_id")
      .populate("institution_id", "institution_name")
      .sort({ received_at: -1 })
      .limit(20)
      .lean();

    return res.json({
      success: true,
      count: candidates.length,
      data: candidates.map((item) => ({
        id: String(item._id),
        case_number: item.case_number,
        subject: item.subject,
        bureau_name: item.bureau_name,
        received_at: item.received_at,
        institution_name: item.institution_id?.institution_name || null,
      })),
    });
  } catch (error) {
    console.error("Search Ripple Radar candidates:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not search complaints for manual grouping",
    });
  }
});

router.post(
  "/:id/review",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
    const {
      decision,
      notes = "",
      selected_case_ids,
      expected_updated_at,
    } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Ripple Radar cluster ID",
      });
    }
    if (
      !allowedDecisions.includes(decision) ||
      typeof notes !== "string" ||
      notes.length > 1000 ||
      typeof expected_updated_at !== "string" ||
      !Number.isFinite(new Date(expected_updated_at).getTime()) ||
      (decision === "ADJUSTED" &&
        (!Array.isArray(selected_case_ids) ||
          selected_case_ids.length < RIPPLE_RADAR_CONFIG.minClusterSize ||
          selected_case_ids.length > RIPPLE_RADAR_CONFIG.maxCases ||
          selected_case_ids.some(
            (id) => !mongoose.isObjectIdOrHexString(id)
          ) ||
          new Set(selected_case_ids.map((id) => id.toLowerCase())).size !==
            selected_case_ids.length)) ||
      (decision !== "ADJUSTED" && selected_case_ids !== undefined)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a valid decision, notes, current cluster timestamp, and valid adjusted member IDs when required",
      });
    }

    try {
      const cluster = await RippleCluster.findById(req.params.id);
      if (!cluster) {
        return res.status(404).json({
          success: false,
          message: "Ripple Radar cluster not found",
        });
      }
      if (cluster.status === "DISMISSED") {
        return res.status(409).json({
          success: false,
          message: "This potential pattern has already been dismissed",
        });
      }
      if (cluster.updated_at.getTime() !== new Date(expected_updated_at).getTime()) {
        return res.status(409).json({
          success: false,
          message: "The cluster changed after it was loaded. Refresh before reviewing.",
        });
      }

      const beforeIds = cluster.cases.map(({ case_id }) => case_id);
      const afterIds =
        decision === "ADJUSTED"
          ? selected_case_ids.map((id) => new mongoose.Types.ObjectId(id))
          : beforeIds;
      const allowedBeforeIds = new Set(beforeIds.map(String));
      if (
        decision === "ADJUSTED" &&
        afterIds.length === allowedBeforeIds.size &&
        afterIds.every((id) => allowedBeforeIds.has(id.toString()))
      ) {
        return res.status(400).json({
          success: false,
          message: "Select a different member grouping to record an adjustment",
        });
      }

      const cases = await ComplaintCase.find({ _id: { $in: afterIds } })
        .select(
          "_id case_number subject bureau_name complaint_type institution_id received_at status"
        )
        .populate("institution_id", "institution_name")
        .lean();
      if (
        decision === "ADJUSTED" &&
        cases.length !== afterIds.length
      ) {
        return res.status(400).json({
          success: false,
          message: "One or more selected complaints no longer exist",
        });
      }
      const cutoff = new Date(
        Date.now() - RIPPLE_RADAR_CONFIG.timeWindowDays * 24 * 60 * 60 * 1000
      );
      const addedCases = cases.filter(
        ({ _id }) => !allowedBeforeIds.has(String(_id))
      );
      if (
        decision === "ADJUSTED" &&
        addedCases.some(
          ({ status, received_at }) =>
            status === "CLOSED" ||
            !received_at ||
            received_at < cutoff ||
            received_at > new Date()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "New grouping members must be non-closed complaints within the configured analysis window",
        });
      }
      if (
        req.user.role === "BUREAU_OFFICER" &&
        (cases.length !== afterIds.length ||
          cases.some(({ bureau_name }) => bureau_name !== req.user.bureau_name))
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Bureau officers can review only clusters whose selected complaints all belong to their bureau",
        });
      }

      const updatedCases =
        decision === "ADJUSTED"
          ? cases.map((candidate) => {
              const existingMember = cluster.cases.find(({ case_id }) =>
                case_id.equals(candidate._id)
              );
              if (!existingMember) {
                return {
                  case_id: candidate._id,
                  case_number: candidate.case_number,
                  subject: candidate.subject,
                  bureau_name: candidate.bureau_name,
                  institution_id: candidate.institution_id?._id || null,
                  institution_name:
                    candidate.institution_id?.institution_name || null,
                  permanent_id: candidate.institution_id?.permanent_id || null,
                  received_at: candidate.received_at,
                  similarity_score: null,
                  matching_reasons: ["Manually added by official"],
                  matching_terms: [],
                  matched_case_numbers: [],
                };
              }

              const matchedCaseNumbers = (
                existingMember.matched_case_numbers || []
              ).filter((number) =>
                cases.some(({ case_number }) => case_number === number)
              );
              if (matchedCaseNumbers.length) {
                return {
                  ...existingMember.toObject(),
                  matched_case_numbers: matchedCaseNumbers,
                };
              }
              return {
                ...existingMember.toObject(),
                similarity_score: null,
                matching_reasons: [
                  "Manually retained in the adjusted grouping",
                ],
                matching_terms: [],
                matched_case_numbers: [],
              };
            })
          : cluster.cases;
      const update = {
        status: decision,
      };
      if (decision === "ADJUSTED") {
        const dates = updatedCases
          .map(({ received_at }) => received_at)
          .filter(Boolean)
          .sort((first, second) => first - second);
        update.cases = updatedCases;
        update.case_count = updatedCases.length;
        update.common_issue = summarizeAdjustedIssue(updatedCases);
        update.matching_reasons = [
          ...new Set(
            updatedCases.flatMap(({ matching_reasons }) => matching_reasons)
          ),
        ].sort();
        update.affected_bureaus = [
          ...new Set(updatedCases.map(({ bureau_name }) => bureau_name)),
        ];
        update.affected_institutions = [
          ...new Set(
            cases
              .map(({ institution_id }) => institution_id?.institution_name)
              .filter(Boolean)
          ),
        ];
        if (dates.length) {
          update.period_start = dates[0];
          update.period_end = dates.at(-1);
        }
      }

      const updated = await RippleCluster.findOneAndUpdate(
        {
          _id: cluster._id,
          updated_at: cluster.updated_at,
          status: { $ne: "DISMISSED" },
        },
        {
          $set: update,
          $push: {
            review_history: {
              decision,
              notes: notes.trim(),
              case_ids_before: beforeIds,
              case_ids_after: afterIds,
              reviewed_by: req.user.id,
              reviewed_at: new Date(),
            },
          },
        },
        { new: true, runValidators: true }
      );
      if (!updated) {
        return res.status(409).json({
          success: false,
          message: "The cluster was changed by another reviewer. Refresh and retry.",
        });
      }
      await updated.populate("review_history.reviewed_by", "full_name");

      return res.json({
        success: true,
        message: `Potential pattern ${decision.toLowerCase()} successfully`,
        data: clusterDto(updated, req.user),
      });
    } catch (error) {
      console.error("Review Ripple Radar cluster:", error.message);
      return res.status(500).json({
        success: false,
        message: "Could not save Ripple Radar review",
      });
    }
  }
);

export default router;
