const User = require("../models/User");

// Get profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Get all mentors (users with skills to teach)
exports.getMentors = async (req, res) => {
  try {
    // Get the current user ID from auth middleware
    const currentUserId = req.user.id;
    
    // Get users who have at least one skill with type "teach", excluding current user
    const mentors = await User.find({
      _id: { $ne: currentUserId },
      "skills.type": "teach"
    }).select("-password");
    
    res.json(mentors);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Update profile (skills + availability + basic info + photo)
exports.updateProfile = async (req, res) => {
  try {
    const { name, title, bio, skills, availability, photo } = req.body;

    // Build update object
    const updateData = {};
    
    // Handle basic info updates
    if (name !== undefined) updateData.name = name;
    if (title !== undefined) updateData.title = title;
    if (bio !== undefined) updateData.bio = bio;

    // Handle photo update (base64 string from client)
    if (photo !== undefined) {
      // Validate base64 image format
      if (photo && !photo.startsWith('data:image/')) {
        return res.status(400).json({ msg: "Invalid photo format" });
      }
      // Check size - base64 strings are ~33% larger than original file
      // Allow up to 3MB original size (roughly 4MB base64 string)
      if (photo && photo.length > 4 * 1024 * 1024) {
        return res.status(400).json({ msg: "Photo size too large (max 3MB)" });
      }
      updateData.photo = photo;
    }

    // Handle skills update
    if (skills !== undefined) {
      if (!Array.isArray(skills)) {
        return res.status(400).json({ msg: "Skills must be an array" });
      }
      for (let skill of skills) {
        if (!skill.name || !skill.type || !skill.level) {
          return res.status(400).json({ msg: "Each skill must have name, type, and level" });
        }
      }
      updateData.skills = skills;
    }

    // Handle availability update
    if (availability !== undefined) {
      if (!Array.isArray(availability)) {
        return res.status(400).json({ msg: "Availability must be an array" });
      }
      updateData.availability = availability;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select("-password");

    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Get all users (for chat - exclude current user)
exports.getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select("name photo isOnline skills")
      .sort({ name: 1 });
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
