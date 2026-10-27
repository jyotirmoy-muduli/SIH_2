import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import { randomBytes } from "node:crypto";
import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose, { connectDatabase } from "./config/db.js";
import authRouter from "./routes/auth.js";
import { authenticate } from "./middleware/auth.js";
import institutionsRouter from "./routes/institutions.js";
import casesRouter from "./routes/cases.js";
import dashboardRouter from "./routes/dashboard.js";
import overlapsRouter from "./routes/overlaps.js";
import slaRoutes from "./routes/sla.js";
import nextActionsRouter from "./routes/nextActions.js";
import rippleRadarRouter from "./routes/rippleRadar.js";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    message: connected
      ? "SIH 26264 backend is running"
      : "Database connection failed",
    database: connected ? mongoose.connection.name : null,
  });
});

function configureAuthenticatedApi() {
  const sessionSecret =
    process.env.AUTH_SESSION_SECRET ||
    (process.env.NODE_ENV === "production"
      ? ""
      : randomBytes(32).toString("hex"));

  if (!sessionSecret) {
    throw new Error("AUTH_SESSION_SECRET is required in production");
  }

  app.use(
    session({
      name: "sih.sid",
      secret: sessionSecret,
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        dbName: mongoose.connection.name,
        collectionName: "sessions",
        ttl: 8 * 60 * 60,
      }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
        path: "/",
      },
    })
  );

  app.use("/api/auth", authRouter);
  app.use("/api", authenticate);
  app.use("/api/overlaps", overlapsRouter);
  app.use("/api/institutions", institutionsRouter);
  app.use("/api/cases", casesRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/sla", slaRoutes);
  app.use("/api/next-actions", nextActionsRouter);
  app.use("/api/ripple-radar", rippleRadarRouter);
}

const PORT = Number(process.env.PORT || 5000);

connectDatabase()
  .then(() => {
    configureAuthenticatedApi();
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection error:", error.message);
    process.exitCode = 1;
  });
