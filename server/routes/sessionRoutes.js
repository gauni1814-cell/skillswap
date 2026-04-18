
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const validate = require('../middleware/validate');
const { scheduleSession } = require('../validators/sessionValidators');

const {
  createSessionRequest,
  getSessions,
  acceptAndSchedule,
  acceptRequest,
  rejectSession,
  completeSession,
  updateMeetingLink,
  startSession
} = require("../controllers/sessionController");

router.post("/", auth, requireRole('learner'), createSessionRequest);
router.get("/", auth, getSessions);
router.put("/accept", auth, requireRole('mentor'), scheduleSession, validate, acceptAndSchedule);
router.put("/accept-request", auth, requireRole('mentor'), acceptRequest);
router.put("/reject", auth, requireRole('mentor'), rejectSession);
router.put("/start", auth, requireRole('learner'), startSession);
router.put("/complete", auth, completeSession);
router.put("/update-link", auth, requireRole('mentor'), updateMeetingLink);
module.exports = router;

