
import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// GET /api/institutions
router.get("/", async (req, res) => {
  try {
    const { search = "" } = req.query;

    const [rows] = await pool.execute(
      `SELECT id, permanent_id, institution_name,
              institution_type, state, district
       FROM institutions
       WHERE permanent_id LIKE ?
          OR institution_name LIKE ?
       ORDER BY institution_name
       LIMIT 100`,
      [`%${search}%`, `%${search}%`]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Fetch institutions:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not fetch institutions"
    });
  }
});

// POST /api/institutions
router.post("/", async (req, res) => {
  try {
    const {
      permanent_id,
      institution_name,
      institution_type,
      state,
      district
    } = req.body;

    if (
      typeof permanent_id !== "string" ||
      !permanent_id.trim() ||
      typeof institution_name !== "string" ||
      !institution_name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Permanent ID and institution name are required"
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO institutions
       (permanent_id, institution_name, institution_type, state, district)
       VALUES (?, ?, ?, ?, ?)`,
      [
        permanent_id.trim(),
        institution_name.trim(),
        institution_type || null,
        state || null,
        district || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Institution created",
      data: {
        id: result.insertId,
        permanent_id: permanent_id.trim(),
        institution_name: institution_name.trim()
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This Permanent ID already exists"
      });
    }

    console.error("Create institution:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not create institution"
    });
  }
});

export default router;
