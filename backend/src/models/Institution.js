import mongoose from "mongoose";

const institutionSchema = new mongoose.Schema(
  {
    permanent_id: { type: String, required: true, unique: true, trim: true },
    aicte_id: { type: String },
    aicte_approved_year: { type: String, default: null },
    aicte_address: { type: String, default: null },
    pid: { type: String, default: null },
    institution_name: { type: String, required: true, trim: true },
    institution_type: { type: String, default: null },
    state: { type: String, default: null },
    district: { type: String, default: null },
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

export default mongoose.model("Institution", institutionSchema);
