import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import pool from "./config/db.js";
import institutionsRouter from "./routes/institutions.js";
import casesRouter from "./routes/cases.js";
import dashboardRouter from "./routes/dashboard.js";
import overlapsRouter from "./routes/overlaps.js";

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);
app.use(express.json());
app.use("/api/overlaps", overlapsRouter);
app.use("/api/institutions", institutionsRouter);
app.use("/api/cases", casesRouter);
app.use("/api/dashboard", dashboardRouter);

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT DATABASE() AS db");

    res.json({
      success: true,
      message: "SIH 26264 backend is running",
      database: rows[0].db,
    });
  } catch (error) {
    console.error("Database connection error:", error.message);
    res.status(503).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});