import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LearnerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Browse
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Mentors
  const [mentors, setMentors] = useState([]);
  const [filteredMentors, setFilteredMentors] = useState([]);

  // Sessions & History
  const [sessions, setSessions] = useState([]);
  const [learningHistory, setLearningHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({});

  // Skill Requests (not used in this view yet)

  const categories = ["all", "technology", "design", "business", "language", "music", "art", "sports"];

  useEffect(() => {
    if (!user || user.role !== "learner") {
      navigate("/");
    }
    fetchDashboardData();
  }, [navigate, user]);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all data in parallel
      const [
        mentorsRes,
        sessionsRes,
        historyRes,
        requestsRes
      ] = await Promise.all([
        fetch("/api/users/mentors", { headers }),
        fetch("/api/session", { headers }),
        fetch("/api/users/learning-history", { headers }),
        fetch("/api/match", { headers })
      ]);

      if (mentorsRes.ok) {
        const data = await mentorsRes.json();
        setMentors(Array.isArray(data) ? data : []);
        setFilteredMentors(Array.isArray(data) ? data : []);
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(Array.isArray(data) ? data.filter(s => s.status !== "completed") : []);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setLearningHistory(data.sessions || []);
        setHistoryStats(data.stats || {});
      }

      if (requestsRes.ok) {
        await requestsRes.json();
        // requests are available but not stored in local state here
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSkills = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/skills/search?query=${encodeURIComponent(searchQuery)}&category=${selectedCategory}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search skills");
    }
  };

  const handleFilterMentors = (query) => {
    if (!query) {
      setFilteredMentors(mentors);
      return;
    }
    const filtered = mentors.filter(
      mentor =>
        mentor.name.toLowerCase().includes(query.toLowerCase()) ||
        mentor.bio?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredMentors(filtered);
  };

  // (Feature) Send request handled from skill details or separate flow

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-slate-600">
            Discover mentors, schedule sessions, and track your learning journey
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
          {["overview", "search", "mentors", "sessions", "history"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
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
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {sessions.length}
                    </div>
                    <div className="text-sm text-slate-600">Upcoming Sessions</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {learningHistory.length}
                    </div>
                    <div className="text-sm text-slate-600">Sessions Completed</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {historyStats.skillsLearned?.length || 0}
                    </div>
                    <div className="text-sm text-slate-600">Skills Learned</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                    <div className="text-3xl font-bold text-orange-600 mb-2">
                      {historyStats.totalHours || 0}h
                    </div>
                    <div className="text-sm text-slate-600">Total Learning Hours</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">🎯 Next Steps</h3>
                    <ul className="space-y-3">
                      <li>
                        <button
                          onClick={() => setActiveTab("search")}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          → Search for skills to learn
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => setActiveTab("mentors")}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          → Browse available mentors
                        </button>
                      </li>
                      <li>
                        <Link
                          to="/profile"
                          className="text-blue-600 hover:underline font-medium"
                        >
                          → Complete your profile
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {sessions.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold mb-4">📅 Upcoming Session</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600">
                          Mentor: <span className="font-medium text-slate-900">{sessions[0]?.mentor?.name}</span>
                        </p>
                        <p className="text-sm text-slate-600">
                          Time: <span className="font-medium text-slate-900">{sessions[0]?.scheduledAt}</span>
                        </p>
                        <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                          Join Session
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search Skills Tab */}
            {activeTab === "search" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-semibold mb-4">🔍 Search Skills</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Category
                      </label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          handleSearchSkills();
                        }}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Search Skills
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="e.g., Python, Guitar, Web Design..."
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleSearchSkills}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                          Search
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-4">Results ({searchResults.length})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {searchResults.map(skill => (
                          <div key={skill._id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            {skill.image && (
                              <img
                                src={skill.image}
                                alt={skill.skillName}
                                className="w-full h-32 object-cover rounded-lg mb-3"
                              />
                            )}
                            <h4 className="font-semibold text-slate-900 mb-1">{skill.skillName}</h4>
                            <p className="text-sm text-slate-600 mb-2">{skill.overview}</p>
                            <div className="flex justify-between items-center">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {skill.category}
                              </span>
                              <button
                                onClick={() => navigate(`/skill/${skill._id}`)}
                                className="text-blue-600 hover:underline text-sm font-medium"
                              >
                                View →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.length === 0 && searchQuery && (
                    <div className="mt-6 text-center text-slate-600">
                      No skills found matching your search.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View Mentors Tab */}
            {activeTab === "mentors" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-semibold mb-4">👨‍🏫 Available Mentors</h2>

                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search mentors..."
                      onChange={(e) => handleFilterMentors(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMentors.map(mentor => (
                      <div
                        key={mentor._id}
                        className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-5 border border-slate-200 hover:shadow-lg transition-shadow"
                      >
                        {mentor.photo && (
                          <img
                            src={mentor.photo}
                            alt={mentor.name}
                            className="w-full h-40 object-cover rounded-lg mb-3"
                          />
                        )}
                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                          {mentor.name}
                        </h3>
                        <div className="flex items-center mb-2">
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={i < Math.floor(mentor.rating || 0) ? "★" : "☆"}>
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="ml-2 text-sm text-slate-600">
                            {mentor.rating?.toFixed(1) || "N/A"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                          {mentor.bio || "No bio provided"}
                        </p>

                        {mentor.skills && mentor.skills.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-slate-700 mb-1">Skills:</p>
                            <div className="flex flex-wrap gap-1">
                              {mentor.skills.slice(0, 2).map(skill => (
                                <span key={skill._id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  {skill.skillName}
                                </span>
                              ))}
                              {mentor.skills.length > 2 && (
                                <span className="text-xs text-slate-600">
                                  +{mentor.skills.length - 2} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Link
                            to={`/profile/${mentor._id}`}
                            className="flex-1 px-3 py-2 bg-slate-300 text-slate-900 rounded-lg text-sm hover:bg-slate-400 font-medium text-center"
                          >
                            View Profile
                          </Link>
                          <Link
                            to={`/chat/${mentor._id}`}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium text-center"
                          >
                            Chat
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredMentors.length === 0 && (
                    <div className="text-center text-slate-600 py-8">
                      No mentors found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sessions Tab */}
            {activeTab === "sessions" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-semibold mb-4">📅 Scheduled Sessions</h2>

                  {sessions.length > 0 ? (
                    <div className="space-y-4">
                      {sessions.map(session => (
                        <div
                          key={session._id}
                          className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                {session.mentor?.name || "Unknown Mentor"}
                              </h4>
                              <p className="text-sm text-slate-600 mt-1">
                                Skill: {session.skillTopic?.skillName || "TBD"}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              {session.status}
                            </span>
                          </div>
                          <div className="text-sm text-slate-700 space-y-1">
                            <p>📊 Duration: {session.duration || "N/A"} minutes</p>
                            <p>🕐 Scheduled: {new Date(session.scheduledAt).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button className="px-4 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                              Join
                            </button>
                            <Link
                              to={`/chat/${session.mentor?._id}`}
                              className="px-4 py-1 bg-slate-300 text-slate-900 rounded text-sm hover:bg-slate-400"
                            >
                              Message
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-600">
                      <p className="mb-4">No scheduled sessions yet.</p>
                      <button
                        onClick={() => setActiveTab("mentors")}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Browse Mentors
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Learning History Tab */}
            {activeTab === "history" && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-semibold mb-4">📚 Learning History</h2>

                  {/* History Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                      <div className="text-2xl font-bold text-green-600">
                        {learningHistory.length}
                      </div>
                      <div className="text-sm text-slate-600">Sessions Completed</div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">
                        {historyStats.totalHours || 0}h
                      </div>
                      <div className="text-sm text-slate-600">Total Learning Time</div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                      <div className="text-2xl font-bold text-purple-600">
                        {historyStats.skillsLearned?.length || 0}
                      </div>
                      <div className="text-sm text-slate-600">Unique Skills</div>
                    </div>
                  </div>

                  {/* History List */}
                  {learningHistory.length > 0 ? (
                    <div className="space-y-3">
                      {learningHistory.map(session => (
                        <div
                          key={session._id}
                          className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-slate-300 transition"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                {session.skillTopic?.skillName || "Unknown Skill"}
                              </h4>
                              <p className="text-sm text-slate-600">
                                with {session.mentor?.name || "Unknown Mentor"}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              ✓ Completed
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            Completed: {new Date(session.completedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-600">
                      <p>No completed sessions yet. Start your learning journey!</p>
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
