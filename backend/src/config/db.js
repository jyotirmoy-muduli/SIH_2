import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export async function connectDatabase() {
  const uri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sih_26264";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}

export default mongoose;
