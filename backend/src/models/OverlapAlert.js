import mongoose from "mongoose";

const overlapAlertSchema = new mongoose.Schema(
  {
    case_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ComplaintCase",
      required: true,
    },
    related_case_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ComplaintCase",
      required: true,
    },
    alert_reason: { type: String, required: true },
    confidence_score: { type: Number, default: null },
    status: {
      type: String,
      enum: ["PENDING", "REVIEWED", "DISMISSED"],
      default: "PENDING",
      index: true,
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

overlapAlertSchema.index({ case_id: 1, related_case_id: 1 }, { unique: true });
overlapAlertSchema.index({ status: 1, case_id: 1 });
overlapAlertSchema.index({ status: 1, related_case_id: 1 });

export default mongoose.model("OverlapAlert", overlapAlertSchema);
