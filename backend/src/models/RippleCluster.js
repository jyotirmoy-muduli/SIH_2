import mongoose from "mongoose";

const rippleMemberSchema = new mongoose.Schema(
  {
    case_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ComplaintCase",
      required: true,
    },
    case_number: { type: String, required: true },
    subject: { type: String, required: true },
    bureau_name: { type: String, required: true },
    institution_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      default: null,
    },
    institution_name: { type: String, default: null },
    permanent_id: { type: String, default: null },
    received_at: { type: Date, default: null },
    similarity_score: { type: Number, min: 0, max: 100, default: null },
    matching_reasons: { type: [String], default: [] },
    matching_terms: { type: [String], default: [] },
    matched_case_numbers: { type: [String], default: [] },
  },
  { _id: false }
);

const rippleReviewSchema = new mongoose.Schema(
  {
    decision: {
      type: String,
      enum: ["CONFIRMED", "DISMISSED", "ADJUSTED"],
      required: true,
    },
    notes: { type: String, default: "", maxlength: 1000 },
    case_ids_before: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ComplaintCase" }],
      default: [],
    },
    case_ids_after: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ComplaintCase" }],
      default: [],
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewed_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const rippleClusterSchema = new mongoose.Schema(
  {
    cluster_key: { type: String, required: true, unique: true },
    source_case_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ComplaintCase" }],
      required: true,
    },
    status: {
      type: String,
      enum: ["SUGGESTED", "CONFIRMED", "DISMISSED", "ADJUSTED"],
      default: "SUGGESTED",
    },
    common_issue: { type: String, required: true },
    case_count: { type: Number, required: true, min: 3 },
    affected_institutions: { type: [String], default: [] },
    affected_bureaus: { type: [String], default: [] },
    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },
    matching_reasons: { type: [String], default: [] },
    algorithm: { type: String, required: true },
    cases: { type: [rippleMemberSchema], required: true },
    review_history: { type: [rippleReviewSchema], default: [] },
    generated_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

rippleClusterSchema.index({ "cases.case_id": 1, status: 1 });
rippleClusterSchema.index({ source_case_ids: 1 });
rippleClusterSchema.index({ status: 1, generated_at: -1 });

export default mongoose.model("RippleCluster", rippleClusterSchema);
