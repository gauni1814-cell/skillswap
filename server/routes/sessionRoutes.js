const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createSession, completeSession, getSessions, acceptSession, updateMeetingLink } = require("../controllers/sessionController");

router.post("/", auth, createSession);          // create new session request
router.put("/accept", auth, acceptSession);     // teacher accepts and generates meeting
router.put("/complete", auth, completeSession); // update feedback & complete
router.put("/update-link", auth, updateMeetingLink); // teacher updates meeting link
router.get("/", auth, getSessions);             // get all sessions for user

module.exports = router;
