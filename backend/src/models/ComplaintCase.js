import mongoose from "mongoose";

const caseActionSchema = new mongoose.Schema({
  action_type: { type: String, required: true },
  previous_status: { type: String, default: null },
  new_status: { type: String, default: null },
  notes: { type: String, default: null },
  event_data: { type: mongoose.Schema.Types.Mixed, default: null },
  performed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  created_at: { type: Date, default: Date.now },
});

const resolutionEvidenceSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    reference: { type: String, default: null, trim: true, maxlength: 500 },
    evidence_type: { type: String, default: null, trim: true, maxlength: 100 },
    added_at: { type: Date, default: Date.now },
    added_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: true }
);

const resolutionSchema = new mongoose.Schema(
  {
    response: { type: String, default: "", trim: true, maxlength: 10000 },
    completed_actions: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: [],
    },
    evidence: { type: [resolutionEvidenceSchema], default: [] },
    updated_at: { type: Date, default: null },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false }
);

const complaintCaseSchema = new mongoose.Schema(
  {
    case_number: { type: String, required: true, unique: true },
    institution_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    bureau_name: { type: String, required: true, index: true },
    complaint_type: { type: String, default: null },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "RECEIVED",
        "UNDER_REVIEW",
        "IN_PROGRESS",
        "AWAITING_RESPONSE",
        "RESOLVED",
        "CLOSED",
        "REOPENED",
      ],
      default: "RECEIVED",
      index: true,
    },
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    received_at: { type: Date, default: Date.now },
    due_date: { type: Date, default: null },
    resolved_at: { type: Date, default: null },
    resolution: { type: resolutionSchema, default: undefined },
    actions: { type: [caseActionSchema], default: [] },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: {
      virtuals: true,
      transform(_document, record) {
        record.id = record._id.toString();
        delete record._id;
        delete record.__v;
        return record;
      },
    },
  }
);

complaintCaseSchema.index({ institution_id: 1, status: 1 });
complaintCaseSchema.index({ status: 1, resolved_at: -1 });
complaintCaseSchema.index({ status: 1, due_date: 1, updated_at: -1 });
complaintCaseSchema.index({ received_at: 1, status: 1 });
complaintCaseSchema.index({ bureau_name: 1, received_at: 1, complaint_type: 1 });

export default mongoose.model("ComplaintCase", complaintCaseSchema);
