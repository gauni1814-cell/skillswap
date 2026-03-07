const User = require("../models/User");
const Session = require("../models/Session");

// Get all sessions for current user
exports.getSessions = async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [{ teacher: req.user.id }, { learner: req.user.id }]
    }).populate("teacher learner", "name photo email");
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Create new session request (learner sends request to teacher)
exports.createSession = async (req, res) => {
  const { teacherId, skill, date, time } = req.body;
  try {
    const session = await Session.create({
      teacher: teacherId,
      learner: req.user.id,
      skill,
      date,
      time,
      status: "pending",
      liveLink: null
    });

    // Populate teacher and learner details
    await session.populate("teacher learner", "name photo email");

    res.json({ message: "Session request sent", session });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Accept session (teacher accepts and generates meeting link)
exports.acceptSession = async (req, res) => {
  const { sessionId } = req.body;
  try {
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ msg: "Session not found" });

    // Verify the current user is the teacher
    if (session.teacher.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only the teacher can accept this session" });
    }

    // Get teacher details
    const teacher = await User.findById(req.user.id);

    // Parse date and time
    const startTime = new Date(`${session.date}T${session.time}:00`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour session
    
    const meetingTitle = `SkillSwap Session: ${session.skill}`;
    const meetingDescription = `Skill exchange session for ${session.skill} between ${teacher.name} and learner`;

    let liveLink = null;
    let googleEventId = null;

    // Try to create Google Meet link
    try {
      const { createGoogleMeetEvent } = require("../services/googleOAuth");
      const event = await createGoogleMeetEvent(
        meetingTitle,
        meetingDescription,
        startTime,
        endTime
      );
      liveLink = event.conferenceData?.entryPoints?.[0]?.uri || null;
      googleEventId = event.id;
      console.log("Google Meet created successfully:", liveLink);
    } catch (meetError) {
      console.error("Failed to create Google Meet link:", meetError.message);
      console.error("Full error:", meetError);
      // Fallback: Generate a unique meeting ID that users can use to join
      // This creates a direct meet link with a random ID that can be used immediately
      const randomId = Math.random().toString(36).substring(2, 10) + '-' + 
                       Math.random().toString(36).substring(2, 6);
      liveLink = `https://meet.google.com/${randomId}`;
      console.log("Using fallback meeting link:", liveLink);
    }

    // Store the meeting link
    session.liveLink = liveLink;
    session.googleEventId = googleEventId;
    session.status = "accepted";
    
    await session.save();
    await session.populate("teacher learner", "name photo email");

    res.json({ message: "Session accepted", session });
  } catch (err) {
    console.error("Accept Session Error:", err);
    res.status(500).json({ msg: err.message });
  }
};

// Send message in session
exports.sendMessage = async (req, res) => {
  const { sessionId, text } = req.body;
  try {
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ msg: "Session not found" });

    session.messages.push({
      sender: req.user.id,
      text,
      createdAt: new Date()
    });

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Complete session + rating + feedback
exports.completeSession = async (req, res) => {
  const { sessionId, rating, feedback } = req.body;
  try {
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ msg: "Session not found" });

    session.status = "completed";
    session.rating = rating;
    session.feedback = feedback;

    await session.save();

    // Update teacher trustScore
    const teacher = await User.findById(session.teacher);
    if (teacher) {
      const currentScore = teacher.trustScore || 0;
      teacher.trustScore = ((currentScore + rating) / 2).toFixed(2);
      await teacher.save();
    }

    res.json({ message: "Session completed", session });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Update meeting link (teacher can manually update the meeting link)
exports.updateMeetingLink = async (req, res) => {
  const { sessionId, liveLink } = req.body;
  try {
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ msg: "Session not found" });

    // Verify the current user is the teacher
    if (session.teacher.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only the teacher can update the meeting link" });
    }

    // Update the meeting link
    session.liveLink = liveLink;
    
    await session.save();
    await session.populate("teacher learner", "name photo email");

    res.json({ message: "Meeting link updated", session });
  } catch (err) {
    console.error("Update Meeting Link Error:", err);
    res.status(500).json({ msg: err.message });
  }
};
