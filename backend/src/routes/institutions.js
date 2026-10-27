import express from "express";
import Institution from "../models/Institution.js";
import { requireRoles } from "../middleware/auth.js";

const router = express.Router();

// GET /api/institutions
router.get("/", async (req, res) => {
  try {
    const search = String(req.query.search || "");
    const filter = search
      ? {
          $or: [
            { permanent_id: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
            { institution_name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
          ],
        }
      : {};
    const institutions = await Institution.find(filter)
      .select("permanent_id institution_name institution_type state district")
      .sort({ institution_name: 1 })
      .limit(100);

    res.json({ success: true, data: institutions });
  } catch (error) {
    console.error("Fetch institutions:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch institutions",
    });
  }
});

// POST /api/institutions
router.post("/", requireRoles("ADMIN"), async (req, res) => {
  const {
    permanent_id,
    institution_name,
    institution_type,
    state,
    district,
  } = req.body;

  if (
    typeof permanent_id !== "string" ||
    !permanent_id.trim() ||
    typeof institution_name !== "string" ||
    !institution_name.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Permanent ID and institution name are required",
    });
  }

  try {
    const institution = await Institution.create({
      permanent_id: permanent_id.trim(),
      institution_name: institution_name.trim(),
      institution_type: institution_type || null,
      state: state || null,
      district: district || null,
    });

    return res.status(201).json({
      success: true,
      message: "Institution created",
      data: {
        id: institution.id,
        permanent_id: institution.permanent_id,
        institution_name: institution.institution_name,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Permanent ID already exists",
      });
    }

    console.error("Create institution:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not create institution",
    });
  }
});

export default router;
