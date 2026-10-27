import express from "express";
import mongoose from "mongoose";
import CaseLink from "../models/CaseLink.js";
import ComplaintCase from "../models/ComplaintCase.js";
import "../models/Institution.js";
import OverlapAlert from "../models/OverlapAlert.js";
import { detectOverlaps } from "../services/overlapDetection.js";
import { canManageCase, requireRoles } from "../middleware/auth.js";

const router = express.Router();

function parseExplanation(reason) {
  try {
    return JSON.parse(reason);
  } catch {
    return reason;
  }
}

// POST /api/overlaps/scan
router.post(
  "/scan",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
  try {
    const result = await detectOverlaps();
    res.json({
      success: true,
      message: "Overlap scan completed",
      data: result,
      }
    );
  } catch (error) {
    console.error("Overlap scan:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not run overlap detection",
    });
  }
});

// GET /api/overlaps?status=PENDING
router.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "PENDING");
    const allowed = ["PENDING", "REVIEWED", "DISMISSED", "ALL"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert status",
      });
    }

    const filter = status === "ALL" ? {} : { status };
    if (req.user.role === "BUREAU_OFFICER") {
      const bureauCaseIds = await ComplaintCase.find({
        bureau_name: req.user.bureau_name,
      }).distinct("_id");
      filter.$or = [
        { case_id: { $in: bureauCaseIds } },
        { related_case_id: { $in: bureauCaseIds } },
      ];
    }
    const alerts = await OverlapAlert.find(filter)
      .populate({
        path: "case_id",
        select: "case_number subject bureau_name status institution_id",
        populate: { path: "institution_id", select: "permanent_id institution_name" },
      })
      .populate({
        path: "related_case_id",
        select: "case_number subject bureau_name status",
      })
      .sort({ confidence_score: -1, created_at: -1 });
    alerts.sort((first, second) => {
      if (first.status === "PENDING" && second.status !== "PENDING") return -1;
      if (second.status === "PENDING" && first.status !== "PENDING") return 1;
      return 0;
    });

    const data = alerts.map((alert) => ({
      alert_id: alert.id,
      case_id: alert.case_id.id,
      related_case_id: alert.related_case_id.id,
      alert_reason: alert.alert_reason,
      confidence_score: alert.confidence_score,
      alert_status: alert.status,
      reviewed_by: alert.reviewed_by?.toString() || null,
      reviewed_at: alert.reviewed_at,
      created_at: alert.created_at,
      case_number: alert.case_id.case_number,
      subject: alert.case_id.subject,
      bureau_name: alert.case_id.bureau_name,
      case_status: alert.case_id.status,
      related_case_number: alert.related_case_id.case_number,
      related_subject: alert.related_case_id.subject,
      related_bureau: alert.related_case_id.bureau_name,
      permanent_id: alert.case_id.institution_id.permanent_id,
      institution_name: alert.case_id.institution_id.institution_name,
      explanation: parseExplanation(alert.alert_reason),
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Fetch overlap alerts:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch overlap alerts",
    });
  }
});

// PATCH /api/overlaps/:id/review
router.patch(
  "/:id/review",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
  const { decision, notes = "" } = req.body;

  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid alert ID",
    });
  }

  const decisions = ["CONFIRMED", "RELATED", "DISMISSED"];
  if (!decisions.includes(decision)) {
    return res.status(400).json({
      success: false,
      message: "Decision must be CONFIRMED, RELATED or DISMISSED",
    });
  }

  if (typeof notes !== "string") {
    return res.status(400).json({
      success: false,
      message: "Notes must be a string",
    });
  }

  try {
    const alert = await OverlapAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Overlap alert not found",
      });
    }
    const complaint = await ComplaintCase.findById(alert.case_id).select(
      "bureau_name"
    );
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }
    if (!canManageCase(req, res, complaint)) return;

    if (alert.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "This alert has already been reviewed",
        }
      );
    }

    if (decision !== "DISMISSED") {
      await CaseLink.findOneAndUpdate(
        { case_id: alert.case_id, related_case_id: alert.related_case_id },
        {
          $set: {
            relationship_type:
              decision === "CONFIRMED"
                ? "POTENTIAL_DUPLICATE"
                : "RELATED_COMPLAINT",
            confidence_score: alert.confidence_score,
            review_status: "CONFIRMED",
            reviewed_by: req.user.id,
            reviewed_at: new Date(),
          },
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    const reviewedAlert = await OverlapAlert.findOneAndUpdate(
      { _id: alert._id, status: "PENDING" },
      {
        $set: {
          status: decision === "DISMISSED" ? "DISMISSED" : "REVIEWED",
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
        },
      },
      { new: true }
    );

    if (!reviewedAlert) {
      return res.status(409).json({
        success: false,
        message: "This alert has already been reviewed",
      });
    }

    await ComplaintCase.updateOne(
      { _id: alert.case_id },
      {
        $push: {
          actions: {
            action_type: "OVERLAP_REVIEW",
            notes: `Alert ${alert.id}: ${decision}. ${notes.slice(0, 1000)}`,
            performed_by: req.user.id,
          },
        },
      }
    );

    return res.json({
      success: true,
      message: `Alert ${decision.toLowerCase()} successfully`,
      data: { alert_id: alert.id, decision },
    });
  } catch (error) {
    console.error("Review overlap alert:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not save review decision",
    });
  }
});

export default router;
