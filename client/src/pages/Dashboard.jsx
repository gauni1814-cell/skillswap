import { useState, useEffect } from "react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("swaps");
  const [sessions, setSessions] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    fetchData();
  };

  const fetchData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const [sessionsRes, matchesRes] = await Promise.all([
        fetch("/api/session", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/matches/matches", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Check if responses are ok
      if (!sessionsRes.ok || !matchesRes.ok) {
        throw new Error("Failed to fetch data");
      }

      // Check content type to avoid JSON parse errors
      const sessionsContentType = sessionsRes.headers.get("content-type");
      const matchesContentType = matchesRes.headers.get("content-type");

      const sessionsData = sessionsContentType?.includes("application/json") 
        ? await sessionsRes.json() 
        : [];
      const matchesData = matchesContentType?.includes("application/json") 
        ? await matchesRes.json() 
        : [];

      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setMatches(Array.isArray(matchesData) ? matchesData : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error fetching data:", err);
      // Set empty arrays on error to prevent crashes
      setSessions([]);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate real stats from sessions
  const activeSwaps = sessions.filter(s => s.status === "accepted").length;
  const pendingRequests = sessions.filter(s => s.status === "pending").length;
  const completedSwaps = sessions.filter(s => s.status === "completed").length;
  const skillsListed = matches.length;

  const mySwaps = sessions.map(session => ({
    skill: session.skill,
    with: session.teacher?.name || session.learner?.name || "User",
    status: session.status.charAt(0).toUpperCase() + session.status.slice(1),
    date: session.date ? `${session.date} at ${session.time}` : "No date set",
  }));

  const incomingRequests = matches.slice(0, 5).map(match => ({
    user: match.name,
    avatar: match.photo || null,
    wants: match.skills?.join(", ") || "Skills",
    offers: "Skill Exchange",
  }));

  const getStatusColor = (status) => {
    switch (status) {
      case "Accepted":
        return "bg-green-100 text-green-700 border-green-200";
      case "Pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Rejected":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="pt-24 pb-12 max-w-7xl mx-auto px-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 max-w-7xl mx-auto px-6">
      {/* HEADER */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Dashboard
          </h2>
          <p className="text-gray-500 mt-1">
            Manage your skill swaps and requests
          </p>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Active Swaps", value: activeSwaps, icon: "🔄", color: "from-blue-500 to-blue-600" },
          { label: "Pending Requests", value: pendingRequests, icon: "📩", color: "from-yellow-500 to-orange-500" },
          { label: "Completed Swaps", value: completedSwaps, icon: "✅", color: "from-green-500 to-emerald-500" },
          { label: "Skills Listed", value: skillsListed, icon: "💡", color: "from-purple-500 to-pink-500" },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 card-hover border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center text-2xl`}>
                {item.icon}
              </div>
              <span className="text-3xl font-bold text-gray-900">{item.value}</span>
            </div>
            <p className="text-gray-500 font-medium">{item.label}</p>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("swaps")}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            activeTab === "swaps"
              ? "bg-white text-primary shadow-md"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          My Swaps
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            activeTab === "requests"
              ? "bg-white text-primary shadow-md"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Incoming Requests
          {pendingRequests > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingRequests}</span>
          )}
        </button>
      </div>

      {/* MY SWAPS */}
      {activeTab === "swaps" && (
        <div className="bg-white rounded-3xl shadow-md p-6 border border-gray-100 animate-fade-in">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="w-2 h-8 bg-primary rounded-full"></span>
            My Swap Requests
          </h3>

          {mySwaps.length > 0 ? (
            <div className="space-y-4">
              {mySwaps.map((swap, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-all duration-200 border border-gray-100"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {swap.skill} ↔ {swap.with}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {swap.date}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(
                      swap.status
                    )}`}
                  >
                    {swap.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
              <p className="text-gray-500">No swap requests yet</p>
            </div>
          )}
        </div>
      )}

      {/* INCOMING REQUESTS */}
      {activeTab === "requests" && (
        <div className="bg-white rounded-3xl shadow-md p-6 border border-gray-100 animate-fade-in">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span className="w-2 h-8 bg-secondary rounded-full"></span>
            Incoming Requests
          </h3>

          {incomingRequests.length > 0 ? (
            <div className="space-y-4">
              {incomingRequests.map((req, i) => (
                <div
                  key={i}
                  className="flex flex-col lg:flex-row justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-all duration-200 border border-gray-100"
                >
                  <div className="flex items-center gap-4">
                    {req.avatar ? (
                      <img src={req.avatar} alt={req.user} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                        {req.user ? req.user.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {req.user}
                      </h4>
                      <p className="text-sm text-gray-500">
                        Wants <span className="text-primary font-medium">{req.wants}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 lg:items-center">
                    <button className="flex-1 lg:flex-none px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all duration-200 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Accept
                    </button>
                    <button className="flex-1 lg:flex-none px-5 py-2.5 border-2 border-gray-200 text-gray-600 font-medium rounded-xl hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-500">No incoming requests</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
