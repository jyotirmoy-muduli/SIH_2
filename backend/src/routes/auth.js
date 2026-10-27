import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({
      success: false,
      message: "Too many sign-in attempts. Try again later.",
    });
  },
});

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

router.post("/login", loginLimiter, async (req, res) => {
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password || email.length > 254 || password.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid email address and password",
    });
  }

  try {
    const user = await User.findOne({ email }).select("+password_hash");
    const passwordMatches =
      user && (await bcrypt.compare(password, user.password_hash));

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Email or password is incorrect",
      });
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    return res.json({
      success: true,
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        bureau_name: user.bureau_name,
      },
    });
  } catch (error) {
    console.error("User login:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not sign in",
    });
  }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

router.post(
  "/users",
  authenticate,
  requireRoles("ADMIN"),
  async (req, res) => {
    const fullName =
      typeof req.body.full_name === "string" ? req.body.full_name.trim() : "";
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";
    const role = req.body.role;
    const bureauName =
      typeof req.body.bureau_name === "string"
        ? req.body.bureau_name.trim()
        : "";

    if (
      !fullName ||
      fullName.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 12 ||
      password.length > 200 ||
      !["BUREAU_OFFICER", "VIEWER"].includes(role) ||
      (role === "BUREAU_OFFICER" && !bureauName)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a name, valid email, password of at least 12 characters, role (BUREAU_OFFICER or VIEWER), and bureau for officers",
      });
    }

    try {
      const password_hash = await bcrypt.hash(password, 12);
      const user = await User.create({
        full_name: fullName,
        email,
        password_hash,
        role,
        bureau_name: role === "BUREAU_OFFICER" ? bureauName : null,
      });

      return res.status(201).json({
        success: true,
        data: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          bureau_name: user.bureau_name,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists",
        });
      }

      console.error("Create user:", error.message);
      return res.status(500).json({
        success: false,
        message: "Could not create user",
      });
    }
  }
);

router.post("/logout", authenticate, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("sih.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res.json({ success: true });
  });
});

export default router;
