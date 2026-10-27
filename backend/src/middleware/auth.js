import mongoose from "mongoose";
import User from "../models/User.js";

export async function authenticate(req, res, next) {
  const userId = req.session?.userId;
  if (!userId || !mongoose.isObjectIdOrHexString(userId)) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const user = await User.findById(userId).select(
      "_id full_name email role bureau_name"
    );
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    req.user = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      bureau_name: user.bureau_name,
    };
    return next();
  } catch (error) {
    console.error("Authenticate request:", error.message);
    return res.status(500).json({
      success: false,
      message: "Could not verify the current user",
    });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }
    return next();
  };
}

export function canManageCase(req, res, complaint) {
  if (
    req.user?.role === "BUREAU_OFFICER" &&
    req.user.bureau_name !== complaint.bureau_name
  ) {
    res.status(403).json({
      success: false,
      message: "You can only manage complaints assigned to your bureau",
    });
    return false;
  }
  return true;
}
