import { useState, useEffect } from "react";
import toast from 'react-hot-toast';
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function MentorDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Mentor-specific data
  const [skills, setSkills] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [sessionStats, setSessionStats] = useState({});
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [learners, setLearners] = useState([]);
  const [reviews, setReviews] = useState([]);

  // Form states
  const [showAddSkillForm, setShowAddSkillForm] = useState(false);
  const [newSkill, setNewSkill] = useState({
    skillName: "",
    category: "technology",
    description: "",
    experienceLevel: "intermediate"
  });

  // Scheduling modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingSession, setSchedulingSession] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  const todayIsoDate = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve
    if (!user || user.role !== "mentor") {
      navigate("/");
      return;
    }
    fetchDashboardData();
  }, [navigate, user, authLoading]);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [
        skillsRes,
        requestsRes,
        sessionsRes,
        mentorSessionRes,
        learnersRes
      ] = await Promise.all([
        fetch("/api/skills/my-skills", { headers }),
        fetch("/api/match/requests", { headers }),
        fetch("/api/session", { headers }),
        fetch("/api/users/mentor-sessions", { headers }),
        fetch("/api/users/learners", { headers })
      ]);

      if (skillsRes.ok) {
        const data = await skillsRes.json();
        setSkills(Array.isArray(data) ? data : []);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setIncomingRequests(Array.isArray(data) ? data : []);
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setUpcomingSessions(Array.isArray(data) ? data.filter(s => s.status === "scheduled") : []);
      }

      if (mentorSessionRes.ok) {
        const data = await mentorSessionRes.json();
        setCompletedSessions(data.sessions || []);
        setSessionStats(data.stats || {});
      }

      if (learnersRes.ok) {
        const data = await learnersRes.json();
        setLearners(Array.isArray(data) ? data : []);
      }
      // fetch my reviews
      try {
        const token = localStorage.getItem('token');
        const r = await fetch('/api/users/reviews/me', { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const d = await r.json();
          setReviews(d.reviews || []);
        }
      } catch (e) { console.warn('Failed to load reviews', e); }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.skillName.trim()) {
      setError("Skill name is required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newSkill)
      });

      if (response.ok) {
        setShowAddSkillForm(false);
        setNewSkill({
          skillName: "",
          category: "technology",
          description: "",
          experienceLevel: "intermediate"
        });
        fetchDashboardData();
      } else {
        setError("Failed to add skill");
      }
    } catch (err) {
      console.error("Error adding skill:", err);
      setError("Failed to add skill");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/session/accept-request`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: requestId })
      });

      if (res.ok) {
        const data = await res.json();
        const session = (data && data.session) ? data.session : null;
        if (session) {
          setSchedulingSession(session);
          // Prefill a generated meeting link for the mentor to edit/confirm
          const gen = (() => {
            const rand = (n) => Math.random().toString(36).substring(2, 2 + n);
            return `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}`;
          })();
          setMeetingLink(gen);
          setShowScheduleModal(true);
        } else {
          fetchDashboardData();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.msg || "Failed to accept request");
      }
    } catch (err) {
      console.error("Error accepting request:", err);
      setError("Failed to accept request");
    }
  };

  const handleScheduleSession = async () => {
    if (!schedulingSession) return;
    if (!scheduleDate || !scheduleTime) {
      toast.error("Please choose date and time");
      return;
    }

    // Validate not scheduling in the past (including today's times)
    const parsed = new Date(`${scheduleDate}T${scheduleTime}`);
    const now = new Date();
    if (isNaN(parsed.getTime())) {
      toast.error('Invalid date or time');
      return;
    }
    if (parsed <= now) {
      toast.error('Cannot schedule sessions in the past');
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/session/accept`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sessionId: schedulingSession._id, date: scheduleDate, time: scheduleTime, meetingLink })
      });

      if (res.ok) {
        setShowScheduleModal(false);
        setSchedulingSession(null);
        setScheduleDate("");
        setScheduleTime("");
        setMeetingLink("");
        fetchDashboardData();
        toast.success('Session scheduled — link emailed and sent via chat');
      } else {
        const err = await res.json();
        toast.error(err.msg || "Failed to schedule session");
      }
    } catch (err) {
      console.error("Error scheduling session:", err);
      toast.error("Failed to schedule session");
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/session/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: requestId })
      });

      if (res.ok) {
        fetchDashboardData();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.msg || "Failed to reject request");
      }
    } catch (err) {
      console.error("Error rejecting request:", err);
      setError("Failed to reject request");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Mentor Dashboard 👨‍🏫
          </h1>
          <p className="text-slate-600">
            Manage your skills, accept requests, and track your mentoring impact
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["overview", "requests", "skills", "sessions", "learners", "reviews"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {tab === "requests" && incomingRequests.length > 0 && (
                <span className="inline-block mr-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
                  {incomingRequests.length}
                </span>
              )}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600">Loading your dashboard...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Impact Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {sessionStats.totalSessions || 0}
                    </div>
                    <div className="text-sm text-slate-600">Sessions Conducted</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {sessionStats.studentsHelped || 0}
                    </div>
                    <div className="text-sm text-slate-600">Students Helped</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {sessionStats.totalHours || 0}h
                    </div>
                    <div className="text-sm text-slate-600">Total Mentoring Hours</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                    <div className="text-3xl font-bold text-yellow-600 mb-2">
                      {user?.rating?.toFixed(1) || "N/A"}
                    </div>
                    <div className="text-sm text-slate-600">Your Rating</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">⚡ Quick Actions</h3>
                    <ul className="space-y-3">
                      <li>
                        <button
                          onClick={() => setActiveTab("skills")}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          → Add or update your skills
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => setActiveTab("requests")}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          → Review incoming requests ({incomingRequests.length})
                        </button>
                      </li>
                      <li>
                        <Link
                          to="/profile"
                          className="text-blue-600 hover:underline font-medium"
                        >
                          → Update availability schedule
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {upcomingSessions.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold mb-4">📅 Next Session</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600">
                          Student: <span className="font-medium text-slate-900">{upcomingSessions[0]?.learner?.name}</span>
                        </p>
                        <p className="text-sm text-slate-600">
                          Skill: <span className="font-medium text-slate-900">{upcomingSessions[0]?.skillTopic?.skillName}</span>
                        </p>
                        <p className="text-sm text-slate-600">
                          Time: <span className="font-medium text-slate-900">{upcomingSessions[0]?.scheduledAt}</span>
                        </p>
                        <button className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                          Join Session
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Incoming Requests Tab */}
            {activeTab === "requests" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-semibold mb-4">
                     Incoming Requests {incomingRequests.length > 0 && `(${incomingRequests.length})`}
                  </h2>

                  {incomingRequests.length > 0 ? (
                    <div className="space-y-4">
                      {incomingRequests.map(request => (
                        <div
                          key={request._id}
                          className="p-5 bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                            {/* Schedule Modal */}
                            {showScheduleModal && (
                              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                                  <h3 className="text-lg font-semibold mb-4">Schedule Session</h3>
                                  <p className="text-sm text-slate-600 mb-4">Student: <span className="font-medium">{schedulingSession?.learner?.name}</span></p>
                                  <div className="space-y-3 mb-4">
                                    <div>
                                      <label className="block text-sm text-slate-700 mb-1">Date</label>
                                      <input type="date" min={todayIsoDate} value={scheduleDate} onChange={(e)=>setScheduleDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
                                    </div>
                                    <div>
                                      <label className="block text-sm text-slate-700 mb-1">Time</label>
                                      <input type="time" value={scheduleTime} onChange={(e)=>setScheduleTime(e.target.value)} className="w-full px-3 py-2 border rounded" />
                                    </div>
                                    <div>
                                      <label className="block text-sm text-slate-700 mb-1">Meeting Link (Zoom/Google Meet)</label>
                                      <input type="url" value={meetingLink} onChange={(e)=>setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." className="w-full px-3 py-2 border rounded" />
                                    </div>
                                  </div>
                                  <div className="flex gap-3 justify-end">
                                    <button onClick={()=>{setShowScheduleModal(false); setSchedulingSession(null);}} className="px-4 py-2 bg-slate-200 rounded">Cancel</button>
                                    <button onClick={handleScheduleSession} className="px-4 py-2 bg-green-600 text-white rounded">Schedule</button>
                                  </div>
                                </div>
                              </div>
                            )}

                              {/* Reviews Tab */}
                              {activeTab === "reviews" && (
                                <div className="space-y-6">
                                  <div className="bg-white rounded-lg shadow p-6">
                                    <h2 className="text-2xl font-semibold mb-4">⭐ Reviews about you</h2>
                                    {reviews.length === 0 ? (
                                      <div className="text-sm text-slate-500">No reviews yet</div>
                                    ) : (
                                      <div className="space-y-3">
                                        {reviews.map(r => (
                                          <div key={r._id || r.createdAt} className="p-3 border rounded-lg">
                                            <div className="flex items-center justify-between">
                                              <div>
                                                <div className="font-medium">{r.fromUser?.name || 'Anonymous'}</div>
                                                <div className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</div>
                                              </div>
                                              <div className="text-sm text-yellow-500 font-bold">{r.rating} ★</div>
                                            </div>
                                            {r.comment && <div className="mt-2 text-sm text-slate-700">{r.comment}</div>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              <h4 className="font-semibold text-slate-900 text-lg">
                                {request.learner?.name || "Unknown Learner"}
                              </h4>
                              <p className="text-sm text-slate-600 mt-1">
                                wants to learn: <span className="font-medium">{request.skillTopic?.skillName || "Unknown Skill"}</span>
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                              {request.status || "pending"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            <div className="text-sm">
                              <p className="text-slate-600">📧 Email:</p>
                              <p className="font-medium text-slate-900">{request.learner?.email}</p>
                            </div>
                            <div className="text-sm">
                              <p className="text-slate-600">⭐ Rating:</p>
                              <p className="font-medium text-slate-900">
                                {request.learner?.rating?.toFixed(1) || "New"} ({request.learner?.reviewsReceived?.length || 0} reviews)
                              </p>
                            </div>
                          </div>

                          {request.message && (
                            <div className="mb-4 p-3 bg-white rounded border border-slate-200">
                              <p className="text-xs text-slate-600 mb-1">Message from learner:</p>
                              <p className="text-sm text-slate-900">{request.message}</p>
                            </div>
                          )}

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAcceptRequest(request._id)}
                              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                            >
                               Accept Request
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request._id)}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                            >
                               Decline
                            </button>
                            <Link
                              to={`/chat/${request.learner?._id}`}
                              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
                            >
                               Chat
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-600">
                      <p className="text-lg mb-2">No incoming requests yet.</p>
                      <p className="text-sm">Update your profile and skills to attract learners!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Manage Skills Tab */}
            {activeTab === "skills" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold">🎓 Your Skills</h2>
                    <button
                      onClick={() => setShowAddSkillForm(!showAddSkillForm)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      {showAddSkillForm ? "× Cancel" : "+ Add Skill"}
                    </button>
                  </div>

                  {showAddSkillForm && (
                    <div className="mb-6 p-5 bg-slate-50 rounded-lg border border-slate-200">
                      <h3 className="font-semibold mb-4">Add New Skill</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Skill Name *
                          </label>
                          <input
                            type="text"
                            value={newSkill.skillName}
                            onChange={(e) => setNewSkill({ ...newSkill, skillName: e.target.value })}
                            placeholder="e.g., Python Programming"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Category
                            </label>
                            <select
                              value={newSkill.category}
                              onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="technology">Technology</option>
                              <option value="design">Design</option>
                              <option value="business">Business</option>
                              <option value="language">Language</option>
                              <option value="music">Music</option>
                              <option value="art">Art</option>
                              <option value="sports">Sports</option>
                              <option value="other">Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              Experience Level
                            </label>
                            <select
                              value={newSkill.experienceLevel}
                              onChange={(e) => setNewSkill({ ...newSkill, experienceLevel: e.target.value })}
                              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                              <option value="expert">Expert</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Description
                          </label>
                          <textarea
                            value={newSkill.description}
                            onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                            placeholder="Describe what you'll teach..."
                            rows="3"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <button
                          onClick={handleAddSkill}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                        >
                          Add Skill
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Skills List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {skills.length > 0 ? (
                      skills.map(skill => (
                        <div
                          key={skill._id}
                          className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:shadow-lg transition"
                        >
                          {skill.image && (
                            <img
                              src={skill.image}
                              alt={skill.skillName}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                            />
                          )}
                          <h4 className="font-semibold text-slate-900 mb-1">
                            {skill.skillName}
                          </h4>
                          <div className="flex gap-2 mb-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {skill.category}
                            </span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              {skill.experienceLevel}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                            {skill.description || "No description"}
                          </p>
                          <button
                            onClick={() => navigate(`/skill/${skill._id}`)}
                            className="w-full px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded border border-blue-300 font-medium"
                          >
                            Edit →
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-8 text-slate-600">
                        <p className="mb-3">No skills added yet.</p>
                        <p className="text-sm">Add your first skill to start attracting learners!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-semibold mb-4">📊 Session History</h2>

                  {/* Upcoming Sessions */}
                  {upcomingSessions.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-blue-600 mb-3">📅 Upcoming Sessions</h3>
                      <div className="space-y-3">
                        {upcomingSessions.map(session => (
                          <div
                            key={session._id}
                            className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold text-slate-900">
                                  {session.learner?.name}
                                </h4>
                                <p className="text-sm text-slate-600">
                                  {session.skillTopic?.skillName}
                                </p>
                              </div>
                              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                                Join
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed Sessions */}
                  <div>
                    <h3 className="text-lg font-semibold text-green-600 mb-3">✓ Completed Sessions</h3>
                    {completedSessions.length > 0 ? (
                      <div className="space-y-3">
                        {completedSessions.map(session => (
                          <div
                            key={session._id}
                            className="p-4 bg-green-50 border-l-4 border-green-500 rounded-lg"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-slate-900">
                                  {session.learner?.name}
                                </h4>
                                <p className="text-sm text-slate-600">
                                  {session.skillTopic?.skillName} • {session.duration} min
                                </p>
                              </div>
                              <span className="text-sm font-medium text-green-700">
                                {new Date(session.completedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-600">
                        <p>No completed sessions yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Learners Tab */}
            {activeTab === "learners" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-semibold mb-4">
                    👥 Learners ({learners.length})
                  </h2>

                  {learners.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {learners.map(learner => (
                        <div
                          key={learner._id}
                          className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 hover:shadow-lg transition"
                        >
                          {learner.photo && (
                            <img
                              src={learner.photo}
                              alt={learner.name}
                              className="w-full h-32 object-cover rounded-lg mb-3"
                            />
                          )}
                          <h3 className="font-semibold text-slate-900 mb-1">
                            {learner.name}
                          </h3>
                          <p className="text-sm text-slate-600 mb-2">
                            {learner.email}
                          </p>
                          {learner.learningGoals && (
                            <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                              Goals: {learner.learningGoals}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Link
                              to={`/chat/${learner._id}`}
                              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 text-center font-medium"
                            >
                              Message
                            </Link>
                            <button className="flex-1 px-3 py-2 bg-slate-300 text-slate-900 text-sm rounded-lg hover:bg-slate-400 font-medium">
                              History
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-600">
                      <p className="text-lg mb-2">No learners yet.</p>
                      <p className="text-sm">Accept requests to start mentoring!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
