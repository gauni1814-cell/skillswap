const mongoose = require("mongoose");

/* =========================
   Skill Schema
========================= */
const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["teach", "learn"],
      required: true,
    },
    level: { type: String },
  },
  { _id: false }
);

/* =========================
   Availability Schema
========================= */
const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String },
    time: { type: String },
  },
  { _id: false }
);

/* =========================
   User Schema
========================= */
const userSchema = new mongoose.Schema(
  {
    // Basic Info
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },

    // 🔐 Normal Login
    password: { type: String }, // hashed password
    
    // 🔑 Password Reset
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    // 🔐 Password Reset OTP
    resetOtp: { type: String },
    resetOtpExpires: { type: Date },

    // 🔑 Google Login
    photo: { type: String },
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    // Role
    role: { type: String, default: "user" },

    // SkillSwap Features
    skills: [skillSchema],
    availability: [availabilitySchema],
    trustScore: { type: Number, default: 0 },

    // 💬 Realtime Chat
    isOnline: { type: Boolean, default: false },

    // 🔗 Google OAuth Tokens
    googleTokens: {
      access_token: { type: String },
      refresh_token: { type: String },
      scope: { type: String },
      token_type: { type: String },
      expiry_date: { type: Number },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
