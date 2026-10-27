import mongoose from "mongoose";

const caseLinkSchema = new mongoose.Schema(
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
    relationship_type: {
      type: String,
      enum: ["POTENTIAL_DUPLICATE", "RELATED_COMPLAINT", "SAME_INCIDENT"],
      default: "RELATED_COMPLAINT",
    },
    confidence_score: { type: Number, default: null },
    review_status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "REJECTED"],
      default: "PENDING",
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

caseLinkSchema.index({ case_id: 1, related_case_id: 1 }, { unique: true });
caseLinkSchema.index({ review_status: 1, case_id: 1 });
caseLinkSchema.index({ review_status: 1, related_case_id: 1 });

export default mongoose.model("CaseLink", caseLinkSchema);
