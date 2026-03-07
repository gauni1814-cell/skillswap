const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  learner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  skill: { type: String, required: true },
  date: { type: String },
  time: { type: String },
  status: { 
    type: String, 
    enum: ["pending", "accepted", "completed", "rejected"], 
    default: "pending" 
  },
  liveLink: { type: String, default: null },
  googleEventId: { type: String, default: null },
  teacherEmail: { type: String, default: null },
  messages: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  rating: { type: Number, default: 0 },
  feedback: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("Session", sessionSchema);
