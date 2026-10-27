import bcrypt from "bcryptjs";
import mongoose, { connectDatabase } from "./config/db.js";
import User from "./models/User.js";

const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const fullName = process.env.INITIAL_ADMIN_NAME?.trim();

if (!email || !password || !fullName) {
  console.error(
    "Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, and INITIAL_ADMIN_NAME in backend/.env before running this command."
  );
  process.exitCode = 1;
} else if (password.length < 12 || password.length > 200) {
  console.error("INITIAL_ADMIN_PASSWORD must be between 12 and 200 characters.");
  process.exitCode = 1;
} else {
  try {
    await connectDatabase();

    if (await User.exists({ email })) {
      throw new Error(
        "An account with this email already exists; the bootstrap command will not reset its password."
      );
    }

    const password_hash = await bcrypt.hash(password, 12);
    await User.create({
      full_name: fullName,
      email,
      password_hash,
      role: "ADMIN",
    });
    console.log("Initial administrator account created.");
  } catch (error) {
    console.error("Could not create initial administrator:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
