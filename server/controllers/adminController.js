const User = require('../models/User');
const Session = require('../models/Session');
const Skill = require('../models/Skill');
const SkillRequest = require('../models/SkillRequest');

exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMentors = await User.countDocuments({ role: 'mentor' });
    const totalLearners = await User.countDocuments({ role: 'learner' });
    const totalSessions = await Session.countDocuments();
    const pendingRequests = await SkillRequest.countDocuments({ status: 'pending' });

    const totalSkills = await Skill.countDocuments();
    const completedSessions = await Session.countDocuments({ status: 'completed' });
    // average rating across users
    const ratingAgg = await User.aggregate([{ $match: { rating: { $exists: true } } }, { $group: { _id: null, avgRating: { $avg: '$rating' } } }]);
    const averageRating = ratingAgg[0]?.avgRating ? Number(ratingAgg[0].avgRating.toFixed(2)) : 0;

    res.json({ totalUsers, totalMentors, totalLearners, totalSkills, totalSessions, pendingRequests, completedSessions, averageRating, revenue: 0 });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;
    const q = {};
    if (role) q.role = role;
    if (search) q.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];

    const users = await User.find(q).select('-password -googleTokens').skip((page-1)*limit).limit(parseInt(limit)).sort({ createdAt: -1 });
    const total = await User.countDocuments(q);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -googleTokens');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.isBlocked !== 'undefined') updates.isBlocked = !!req.body.isBlocked;
    if (req.body.role) updates.role = req.body.role;
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password -googleTokens');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'User updated', user });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'User deleted' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.listSessions = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const q = {};
    if (status) q.status = status;
    const sessions = await Session.find(q).populate('learner mentor', 'name email photo').populate('skillTopic', 'skillName').skip((page-1)*limit).limit(parseInt(limit)).sort({ createdAt: -1 });
    const total = await Session.countDocuments(q);
    res.json({ sessions, total });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.forceCancelSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ msg: 'Session not found' });
    session.status = 'cancelled';
    await session.save();
    res.json({ msg: 'Session cancelled', session });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Admin: list all skills with optional filters
exports.listSkills = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const q = {};
    if (category) q.category = category;
    if (search) q.skillName = { $regex: search, $options: 'i' };

    const total = await Skill.countDocuments(q);
    const skills = await Skill.find(q).populate('user', 'name email photo').skip((page-1)*limit).limit(parseInt(limit)).sort({ createdAt: -1 });
    res.json({ skills, total });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Admin: delete any skill
exports.deleteSkill = async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) return res.status(404).json({ msg: 'Skill not found' });
    await Skill.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Skill deleted' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Admin: get settings
exports.getSettings = async (req, res) => {
  try {
    const Setting = require('../models/Setting');
    const settings = await Setting.find().lean();
    const result = {};
    settings.forEach(s => result[s.key] = s.value);
    res.json({ settings: result });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Admin: update settings (upsert)
exports.updateSettings = async (req, res) => {
  try {
    const Setting = require('../models/Setting');
    const updates = req.body || {};
    const keys = Object.keys(updates);
    for (const key of keys) {
      await Setting.findOneAndUpdate({ key }, { value: updates[key] }, { upsert: true, new: true });
    }
    const settings = await Setting.find().lean();
    const result = {};
    settings.forEach(s => result[s.key] = s.value);
    res.json({ settings: result });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Send arbitrary email to a user (admin only)
exports.sendEmailToUser = async (req, res) => {
  try {
    const { subject, html, text } = req.body;
    const user = await User.findById(req.params.id).select('email name');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const { sendMail } = require('../services/email');
    await sendMail({ to: user.email, subject, html, text });
    res.json({ msg: 'Email sent' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Aggregate all reviews across users for admin view
exports.listReviews = async (req, res) => {
  try {
    // unwind reviewsReceived across users
    const reviews = await User.aggregate([
      { $unwind: '$reviewsReceived' },
      { $replaceRoot: { newRoot: { $mergeObjects: [ '$reviewsReceived', { reviewedUser: '$_id' } ] } } },
      { $lookup: { from: 'users', localField: 'fromUser', foreignField: '_id', as: 'fromUser' } },
      { $unwind: { path: '$fromUser', preserveNullAndEmptyArrays: true } },
      { $project: { rating: 1, comment: 1, createdAt: 1, reviewedUser: 1, fromUser: { _id: '$fromUser._id', name: '$fromUser.name', email: '$fromUser.email' } } },
      { $sort: { createdAt: -1 } }
    ]).exec();

    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
