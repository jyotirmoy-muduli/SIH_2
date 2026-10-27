import express from "express";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import CaseLink from "../models/CaseLink.js";
import ComplaintCase from "../models/ComplaintCase.js";
import OverlapAlert from "../models/OverlapAlert.js";
import "../models/Institution.js";
import "../models/User.js";
import { canManageCase, requireRoles } from "../middleware/auth.js";
import { recommendNextAction } from "../services/nextActionService.js";

const router = express.Router();

async function getRelationshipCounts(caseId) {
  const counts = await getRelationshipCountsForCases([{ _id: caseId }]);
  return counts.get(caseId.toString());
}

async function getRelationshipCountsForCases(complaints) {
  const caseIds = complaints.map(({ _id }) => _id);
  const counts = new Map(
    caseIds.map((id) => [
      id.toString(),
      { confirmedRelatedIds: new Set(), pendingOverlapIds: new Set() },
    ])
  );
  if (!caseIds.length) return counts;

  const [links, alerts] = await Promise.all([
    CaseLink.find({
      review_status: "CONFIRMED",
      $or: [
        { case_id: { $in: caseIds } },
        { related_case_id: { $in: caseIds } },
      ],
    })
      .select("case_id related_case_id")
      .lean(),
    OverlapAlert.find({
      status: "PENDING",
      $or: [
        { case_id: { $in: caseIds } },
        { related_case_id: { $in: caseIds } },
      ],
    })
      .select("case_id related_case_id")
      .lean(),
  ]);

  for (const link of links) {
    counts
      .get(link.case_id.toString())
      ?.confirmedRelatedIds.add(link.related_case_id.toString());
    counts
      .get(link.related_case_id.toString())
      ?.confirmedRelatedIds.add(link.case_id.toString());
  }
  for (const alert of alerts) {
    counts
      .get(alert.case_id.toString())
      ?.pendingOverlapIds.add(alert.related_case_id.toString());
    counts
      .get(alert.related_case_id.toString())
      ?.pendingOverlapIds.add(alert.case_id.toString());
  }

  for (const [id, count] of counts) {
    counts.set(id, {
      confirmedRelatedCount: count.confirmedRelatedIds.size,
      pendingOverlapCount: count.pendingOverlapIds.size,
    });
  }
  return counts;
}

function presentRecommendation(complaint, relationshipCounts, now = new Date()) {
  const recommendation = recommendNextAction(
    complaint,
    { ...relationshipCounts, now }
  );
  const updatedAt = complaint.updated_at
    ? new Date(complaint.updated_at).getTime()
    : 0;
  const recommendationId = createHash("sha256")
    .update(
      JSON.stringify([
        complaint.id,
        updatedAt,
        complaint.actions?.length || 0,
        recommendation,
      ])
    )
    .digest("hex");

  return {
    recommendation_id: recommendationId,
    recommendation,
  };
}

function presentCase(complaint, recommendation) {
  return {
    id: complaint.id,
    case_number: complaint.case_number,
    subject: complaint.subject,
    bureau_name: complaint.bureau_name,
    priority: complaint.priority,
    status: complaint.status,
    due_date: complaint.due_date,
    institution_name: complaint.institution_id?.institution_name || null,
    permanent_id: complaint.institution_id?.permanent_id || null,
    assigned_officer: complaint.assigned_to?.full_name || null,
    ...recommendation,
  };
}

async function loadCaseRecommendation(complaint, now) {
  const relationshipCounts = await getRelationshipCounts(complaint._id);
  return presentRecommendation(complaint, relationshipCounts, now);
}

router.get("/", async (req, res) => {
  try {
    const filter =
      req.user.role === "BUREAU_OFFICER"
        ? { bureau_name: req.user.bureau_name }
        : {};
    const complaints = await ComplaintCase.find(filter)
      .select(
        "case_number subject description bureau_name priority status due_date resolved_at resolution assigned_to institution_id actions updated_at"
      )
      .populate("institution_id", "permanent_id institution_name")
      .populate("assigned_to", "full_name")
      .sort({ due_date: 1, updated_at: -1 })
      .limit(500);
    const now = new Date();
    const relationshipCounts = await getRelationshipCountsForCases(complaints);
    const data = complaints.map((complaint) =>
      presentCase(
        complaint,
        presentRecommendation(
          complaint,
          relationshipCounts.get(complaint._id.toString()),
          now
        )
      )
    );
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Fetch next-action recommendations:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not generate next-action recommendations",
    });
  }
});

router.post(
  "/:caseId/decision",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
    const { recommendation_id, decision, modified_action, notes = "" } =
      req.body || {};
    const decisions = ["ACCEPTED", "REJECTED", "MODIFIED"];

    if (!mongoose.isObjectIdOrHexString(req.params.caseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID",
      });
    }

    if (
      typeof recommendation_id !== "string" ||
      recommendation_id.length > 200 ||
      !decisions.includes(decision) ||
      (decision === "MODIFIED" &&
        (typeof modified_action !== "string" ||
          !modified_action.trim() ||
          modified_action.trim().length > 500)) ||
      (decision !== "MODIFIED" && modified_action !== undefined) ||
      typeof notes !== "string" ||
      notes.length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a current recommendation ID, valid decision, and required modification or notes",
      });
    }

    try {
      const complaint = await ComplaintCase.findById(req.params.caseId)
        .populate("assigned_to", "full_name")
        .populate("institution_id", "permanent_id institution_name");
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found",
        });
      }
      if (!canManageCase(req, res, complaint)) return;

      const current = await loadCaseRecommendation(complaint, new Date());
      if (current.recommendation_id !== recommendation_id) {
        return res.status(409).json({
          success: false,
          message:
            "The case changed after this recommendation was generated. Refresh before recording a decision.",
        });
      }
      if (current.recommendation.action === "NO_ACTION_REQUIRED") {
        return res.status(409).json({
          success: false,
          message: "No operational recommendation is available for this case",
        });
      }

      const selectedAction =
        decision === "REJECTED"
          ? null
          : decision === "MODIFIED"
            ? modified_action.trim()
            : current.recommendation.action;
      const action = {
        action_type: "NEXT_ACTION_DECISION",
        notes: notes.trim() || `Recommendation ${decision.toLowerCase()}.`,
        event_data: {
          recommendation_id,
          recommended_action: current.recommendation.action,
          selected_action: selectedAction,
          decision,
          explanation: current.recommendation.explanation,
          supporting_facts: current.recommendation.supporting_facts,
          urgency: current.recommendation.urgency,
          suggested_responsible_role:
            current.recommendation.suggested_responsible_role,
        },
        performed_by: req.user.id,
      };
      complaint.actions.push(action);
      await complaint.save();

      return res.status(201).json({
        success: true,
        message: "Recommendation decision recorded",
        data: {
          id: complaint.id,
          decision,
          selected_action: selectedAction,
          decision_id: complaint.actions.at(-1).id,
          recorded_at: complaint.actions.at(-1).created_at,
        },
      });
    } catch (error) {
      console.error("Record next-action decision:", error.message);
      return res.status(500).json({
        success: false,
        message: "Could not record recommendation decision",
      });
    }
  }
);

router.post(
  "/:caseId/outcome",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
    const { decision_id, outcome } = req.body || {};

    if (
      !mongoose.isObjectIdOrHexString(req.params.caseId) ||
      !mongoose.isObjectIdOrHexString(decision_id) ||
      typeof outcome !== "string" ||
      !outcome.trim() ||
      outcome.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a valid case ID, decision ID, and outcome of at most 1000 characters",
      });
    }

    try {
      const complaint = await ComplaintCase.findById(req.params.caseId);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found",
        });
      }
      if (!canManageCase(req, res, complaint)) return;

      const decision = complaint.actions.find(
        (action) =>
          action.id === decision_id &&
          action.action_type === "NEXT_ACTION_DECISION"
      );
      if (!decision) {
        return res.status(404).json({
          success: false,
          message: "Recommendation decision not found for this complaint",
        });
      }
      if (decision.event_data?.decision === "REJECTED") {
        return res.status(409).json({
          success: false,
          message: "An outcome cannot be recorded for a rejected recommendation",
        });
      }

      const alreadyRecorded = complaint.actions.some(
        (action) =>
          action.action_type === "NEXT_ACTION_OUTCOME" &&
          action.event_data?.decision_id === decision_id
      );
      if (alreadyRecorded) {
        return res.status(409).json({
          success: false,
          message: "An outcome has already been recorded for this decision",
        });
      }

      complaint.actions.push({
        action_type: "NEXT_ACTION_OUTCOME",
        notes: outcome.trim(),
        event_data: {
          decision_id,
          selected_action: decision.event_data.selected_action,
        },
        performed_by: req.user.id,
      });
      await complaint.save();

      return res.status(201).json({
        success: true,
        message: "Recommendation outcome recorded",
        data: {
          id: complaint.id,
          decision_id,
          recorded_at: complaint.actions.at(-1).created_at,
        },
      });
    } catch (error) {
      console.error("Record next-action outcome:", error.message);
      return res.status(500).json({
        success: false,
        message: "Could not record recommendation outcome",
      });
    }
  }
);

export default router;
