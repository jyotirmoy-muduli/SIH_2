import express from "express";
import mongoose from "mongoose";
import ComplaintCase from "../models/ComplaintCase.js";
import Institution from "../models/Institution.js";
import "../models/User.js";
import { canManageCase, requireRoles } from "../middleware/auth.js";
import { CLOSURE_RULES } from "../config/closureIntegrity.js";
import { assessResolutionIntegrity } from "../services/resolutionIntegrity.js";

const router = express.Router();

const allowedStatuses = [
  "RECEIVED",
  "UNDER_REVIEW",
  "IN_PROGRESS",
  "AWAITING_RESPONSE",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];
const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const allowedResolutionReviews = ["ACCEPTED", "NEEDS_FOLLOW_UP"];

function isValidId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function isValidDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatCase(record) {
  return {
    id: record.id,
    case_number: record.case_number,
    subject: record.subject,
    description: record.description,
    bureau_name: record.bureau_name,
    complaint_type: record.complaint_type,
    priority: record.priority,
    status: record.status,
    received_at: record.received_at,
    due_date: record.due_date,
    resolved_at: record.resolved_at,
    institution_id: record.institution_id?.id || record.institution_id,
    permanent_id: record.institution_id?.permanent_id,
    institution_name: record.institution_id?.institution_name,
    assigned_officer: record.assigned_to?.full_name || null,
  };
}

// GET /api/cases
router.get("/", async (req, res) => {
  try {
    const { status, bureau, priority, search } = req.query;
    const filter = {};

    if (req.user.role === "BUREAU_OFFICER") {
      filter.bureau_name = req.user.bureau_name;
    }

    if (status) {
      if (typeof status !== "string" || !allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      filter.status = status;
    }

    if (bureau) {
      if (
        req.user.role === "BUREAU_OFFICER" &&
        bureau !== req.user.bureau_name
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only view complaints for your bureau",
        });
      }
      filter.bureau_name = String(bureau);
    }

    if (priority) {
      if (
        typeof priority !== "string" ||
        !allowedPriorities.includes(priority)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid priority filter",
        });
      }
      filter.priority = priority;
    }

    if (search) {
      const expression = new RegExp(escapeRegex(String(search)), "i");
      const institutions = await Institution.find({
        $or: [
          { permanent_id: expression },
          { institution_name: expression },
        ],
      }).select("_id");

      filter.$or = [
        { case_number: expression },
        { subject: expression },
        { institution_id: { $in: institutions.map(({ _id }) => _id) } },
      ];
    }

    const records = await ComplaintCase.find(filter)
      .populate("institution_id", "permanent_id institution_name")
      .populate("assigned_to", "full_name")
      .sort({ received_at: -1 })
      .limit(200);
    const data = records.map(formatCase);

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Fetch cases:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch complaint cases",
    });
  }
});

// POST /api/cases
router.post("/", requireRoles("ADMIN", "BUREAU_OFFICER"), async (req, res) => {
  const {
    institution_id,
    subject,
    description,
    bureau_name,
    complaint_type,
    priority = "MEDIUM",
    due_date = null,
  } = req.body;

  if (
    !isValidId(institution_id) ||
    typeof subject !== "string" ||
    !subject.trim() ||
    typeof description !== "string" ||
    !description.trim() ||
    typeof bureau_name !== "string" ||
    !bureau_name.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid institution, subject, description and bureau are required",
    });
  }

  if (
    req.user.role === "BUREAU_OFFICER" &&
    bureau_name.trim() !== req.user.bureau_name
  ) {
    return res.status(403).json({
      success: false,
      message: "You can only register complaints for your bureau",
    });
  }

  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      message: "Invalid priority",
    });
  }

  if (complaint_type != null && typeof complaint_type !== "string") {
    return res.status(400).json({
      success: false,
      message: "Complaint type must be a string",
    });
  }

  if (due_date !== null && !isValidDate(due_date)) {
    return res.status(400).json({
      success: false,
      message: "Due date must be a valid YYYY-MM-DD date",
    });
  }

  try {
    const institution = await Institution.findById(institution_id).select("_id");
    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

    const caseNumber =
      `AICTE-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    const complaint = await ComplaintCase.create({
      case_number: caseNumber,
      institution_id: institution._id,
      subject: subject.trim(),
      description: description.trim(),
      bureau_name: bureau_name.trim(),
      complaint_type: complaint_type?.trim() || null,
      priority,
      status: "RECEIVED",
      due_date: due_date ? new Date(`${due_date}T00:00:00.000Z`) : null,
      actions: [{
        action_type: "CASE_CREATED",
        new_status: "RECEIVED",
        notes: "Complaint registered",
        performed_by: req.user.id,
      }],
    });

    return res.status(201).json({
      success: true,
      message: "Complaint created",
      data: {
        id: complaint.id,
        case_number: caseNumber,
        status: "RECEIVED",
      },
    });
  } catch (error) {
    console.error("Create case:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not create complaint",
    });
  }
});

// PATCH /api/cases/:id/status
router.patch(
  "/:id/status",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
    const { status, notes } = req.body;

    if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID",
    });
  }

    if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status",
    });
  }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return res.status(400).json({
      success: false,
      message: "Notes must be a string",
    });
  }

    try {
      const complaint = await ComplaintCase.findById(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found",
        });
      }
      if (!canManageCase(req, res, complaint)) return;

      if (
        CLOSURE_RULES.blockingEnabled &&
        ["RESOLVED", "CLOSED"].includes(status)
      ) {
        const integrity = assessResolutionIntegrity(complaint);
        if (integrity.can_block_closure) {
          return res.status(409).json({
            success: false,
            message: "Mandatory resolution requirements are incomplete",
            data: { resolution_integrity: integrity },
          });
        }
      }

      const previousStatus = complaint.status;
      if (previousStatus === status) {
        return res.json({
          success: true,
          message: "Complaint already has this status",
          data: {
            id: complaint.id,
            previous_status: previousStatus,
            status,
            unchanged: true,
            ...( ["RESOLVED", "CLOSED"].includes(status)
              ? { resolution_integrity: assessResolutionIntegrity(complaint) }
              : {}),
          },
        });
      }

      const closureIntegrity = ["RESOLVED", "CLOSED"].includes(status)
        ? assessResolutionIntegrity(complaint)
        : null;
      complaint.status = status;
      complaint.resolved_at =
        status === "RESOLVED"
          ? new Date()
          : ["REOPENED", "IN_PROGRESS", "UNDER_REVIEW", "RECEIVED", "AWAITING_RESPONSE"].includes(status)
            ? null
            : complaint.resolved_at;
      complaint.actions.push({
        action_type: "STATUS_CHANGED",
        previous_status: previousStatus,
        new_status: status,
        notes: notes?.trim() || null,
        event_data: closureIntegrity
          ? {
              resolution_integrity_status: closureIntegrity.status,
              mandatory_failures: closureIntegrity.mandatory_failures,
            }
          : null,
        performed_by: req.user.id,
      });
      await complaint.save();

      return res.json({
        success: true,
        message: "Complaint status updated",
        data: {
          id: complaint.id,
          previous_status: previousStatus,
          status,
          ...(closureIntegrity
            ? { resolution_integrity: closureIntegrity }
            : {}),
        },
      });
    } catch (error) {
      console.error("Update case status:", error.message);
      return res.status(500).json({
        success: false,
        message: "Could not update complaint status",
      });
    }
  }
);

router.get("/resolution-integrity", async (req, res) => {
  try {
    const filter = { status: { $in: ["RESOLVED", "CLOSED"] } };
    if (req.user.role === "BUREAU_OFFICER") {
      filter.bureau_name = req.user.bureau_name;
    }

    const complaints = await ComplaintCase.find(filter)
      .select(
        "case_number subject description complaint_type bureau_name priority status resolved_at resolution institution_id"
      )
      .populate("institution_id", "permanent_id institution_name")
      .sort({ resolved_at: -1 })
      .limit(200);
    const data = complaints.map((complaint) => ({
      id: complaint.id,
      case_number: complaint.case_number,
      subject: complaint.subject,
      complaint_type: complaint.complaint_type,
      bureau_name: complaint.bureau_name,
      priority: complaint.priority,
      status: complaint.status,
      resolved_at: complaint.resolved_at,
      institution_name: complaint.institution_id?.institution_name || null,
      permanent_id: complaint.institution_id?.permanent_id || null,
      resolution: complaint.resolution || {
        response: "",
        completed_actions: [],
        evidence: [],
      },
      resolution_integrity: assessResolutionIntegrity(complaint),
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("List resolution integrity checks:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch resolution integrity checks",
    });
  }
});

router.get("/:id/resolution-integrity", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID",
    });
  }

  try {
    const complaint = await ComplaintCase.findById(req.params.id).populate(
      "institution_id",
      "permanent_id institution_name"
    );
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }
    if (
      req.user.role === "BUREAU_OFFICER" &&
      !canManageCase(req, res, complaint)
    ) {
      return;
    }

    return res.json({
      success: true,
      data: {
        id: complaint.id,
        case_number: complaint.case_number,
        subject: complaint.subject,
        description: complaint.description,
        complaint_type: complaint.complaint_type,
        bureau_name: complaint.bureau_name,
        priority: complaint.priority,
        status: complaint.status,
        resolved_at: complaint.resolved_at,
        institution_name: complaint.institution_id?.institution_name || null,
        permanent_id: complaint.institution_id?.permanent_id || null,
        resolution: complaint.resolution || {
          response: "",
          completed_actions: [],
          evidence: [],
        },
        resolution_integrity: assessResolutionIntegrity(complaint),
      },
    });
  } catch (error) {
    console.error("Check resolution integrity:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not check resolution integrity",
    });
  }
});

router.put(
  "/:id/resolution",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID",
      });
    }

    const { response, completed_actions, evidence } = req.body;
    if (
      typeof response !== "string" ||
      response.length > 10000 ||
      !Array.isArray(completed_actions) ||
      completed_actions.length > 20 ||
      completed_actions.some(
        (action) =>
          typeof action !== "string" ||
          !action.trim() ||
          action.trim().length > 500
      ) ||
      !Array.isArray(evidence) ||
      evidence.length > 20 ||
      evidence.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          typeof item.label !== "string" ||
          !item.label.trim() ||
          item.label.trim().length > 200 ||
          (item.reference != null &&
            (typeof item.reference !== "string" ||
              item.reference.length > 500)) ||
          (item.evidence_type != null &&
            (typeof item.evidence_type !== "string" ||
              item.evidence_type.length > 100))
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a response, up to 20 completed actions, and up to 20 evidence references with valid labels",
      });
    }

    try {
      const complaint = await ComplaintCase.findById(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found",
        });
      }
      if (!canManageCase(req, res, complaint)) return;

      const savedAt = new Date();
      complaint.resolution = {
        response: response.trim(),
        completed_actions: completed_actions.map((action) => action.trim()),
        evidence: evidence.map((item) => ({
          label: item.label.trim(),
          reference: item.reference?.trim() || null,
          evidence_type: item.evidence_type?.trim() || null,
          added_at: savedAt,
          added_by: req.user.id,
        })),
        updated_at: savedAt,
        updated_by: req.user.id,
      };
      complaint.actions.push({
        action_type: "RESOLUTION_DETAILS_RECORDED",
        notes: "Resolution response, actions, or evidence references updated.",
        event_data: {
          response_characters: response.trim().length,
          completed_action_count: completed_actions.length,
          evidence_count: evidence.length,
        },
        performed_by: req.user.id,
      });
      await complaint.save();

      return res.json({
        success: true,
        data: {
          id: complaint.id,
          resolution: complaint.resolution,
          resolution_integrity: assessResolutionIntegrity(complaint),
        },
      });
    } catch (error) {
      console.error("Save resolution details:", error.message);
      return res.status(500).json({
        success: false,
        message: "Could not save resolution details",
      });
    }
  }
);

router.post(
  "/:id/resolution-integrity/review",
  requireRoles("ADMIN", "BUREAU_OFFICER"),
  async (req, res) => {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID",
      });
    }

    const { decision, notes = "" } = req.body;
    if (
      !allowedResolutionReviews.includes(decision) ||
      typeof notes !== "string" ||
      notes.length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Decision must be ACCEPTED or NEEDS_FOLLOW_UP and notes must be at most 1000 characters",
      });
    }

    try {
      const complaint = await ComplaintCase.findById(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found",
        });
      }
      if (!canManageCase(req, res, complaint)) return;

      const integrity = assessResolutionIntegrity(complaint);
      complaint.actions.push({
        action_type: "RESOLUTION_INTEGRITY_REVIEW",
        notes: notes.trim() || `Resolution integrity review: ${decision}.`,
        event_data: {
          decision,
          assessment_status: integrity.status,
          check_results: integrity.checks.map(({ id, status }) => ({
            id,
            status,
          })),
        },
        performed_by: req.user.id,
      });
      await complaint.save();

      return res.json({
        success: true,
        message: "Resolution integrity review recorded",
        data: {
          id: complaint.id,
          decision,
          reviewed_at: complaint.actions.at(-1).created_at,
          resolution_integrity: integrity,
        },
      });
    } catch (error) {
      console.error("Review resolution integrity:", error.message);
      return res.status(500).json({
        success: false,
        message: "Could not record resolution integrity review",
      });
    }
  }
);

// GET /api/cases/:id/history
router.get("/:id/history", async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID",
    });
  }

  try {
    const complaint = await ComplaintCase.findById(req.params.id)
      .populate("actions.performed_by", "full_name");

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }
    if (
      req.user.role === "BUREAU_OFFICER" &&
      !canManageCase(req, res, complaint)
    ) {
      return;
    }

    const history = complaint.actions
      .slice()
      .sort((first, second) => first.created_at - second.created_at)
      .map((action) => ({
        id: action.id,
        action_type: action.action_type,
        previous_status: action.previous_status,
        new_status: action.new_status,
        notes: action.notes,
        event_data: action.event_data,
        performed_by: action.performed_by?.id || null,
        performed_by_name: action.performed_by?.full_name || null,
        created_at: action.created_at,
      }));

    return res.json({
      success: true,
      data: {
        case: {
          id: complaint.id,
          case_number: complaint.case_number,
          subject: complaint.subject,
        },
        count: history.length,
        history,
      },
    });
  } catch (error) {
    console.error("Fetch case history:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not fetch case history",
    });
  }
});

export default router;
