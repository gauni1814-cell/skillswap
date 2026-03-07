import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

export default function BrowseSkills() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [requestForm, setRequestForm] = useState({ skill: "", date: "", time: "" });
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchMentors();
    
    // Listen for user status changes
    const handleStatusChange = (event) => {
      const { userId, isOnline } = event.detail;
      setMentors(prev => prev.map(mentor => 
        mentor._id === userId ? { ...mentor, isOnline } : mentor
      ));
    };
    
    window.addEventListener("userStatusChange", handleStatusChange);
    
    return () => {
      window.removeEventListener("userStatusChange", handleStatusChange);
    };
  }, []);

  const fetchMentors = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch("/api/users/mentors", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch mentors");
      const data = await response.json();
      setMentors(data);
    } catch (err) {
      console.error("Error fetching mentors:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestClick = (mentor) => {
    setSelectedMentor(mentor);
    const teachSkill = mentor.skills?.find(s => s.type === "teach");
    setRequestForm({ 
      skill: teachSkill?.name || "", 
      date: "", 
      time: "" 
    });
    setShowRequestModal(true);
    setRequestError("");
    setRequestSuccess(false);
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    
    if (!token) {
      navigate("/login");
      return;
    }

    if (!requestForm.skill || !requestForm.date || !requestForm.time) {
      setRequestError("Please fill in all fields");
      return;
    }

    setSendingRequest(true);
    setRequestError("");

    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          teacherId: selectedMentor._id,
          skill: requestForm.skill,
          date: requestForm.date,
          time: requestForm.time
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || "Failed to send request");
      }

      setRequestSuccess(true);
      setTimeout(() => {
        setShowRequestModal(false);
        navigate("/sessions");
      }, 1500);
    } catch (err) {
      console.error("Error sending request:", err);
      setRequestError(err.message);
    } finally {
      setSendingRequest(false);
    }
  };

  const filteredMentors = mentors.filter(mentor => {
    const teachSkills = mentor.skills?.filter(s => s.type === "teach") || [];
    const learnSkills = mentor.skills?.filter(s => s.type === "learn") || [];
    
    const searchLower = searchTerm.toLowerCase();
    return (
      mentor.name?.toLowerCase().includes(searchLower) ||
      teachSkills.some(s => s.name?.toLowerCase().includes(searchLower)) ||
      learnSkills.some(s => s.name?.toLowerCase().includes(searchLower))
    );
  });

  const getTeachSkills = (mentor) => {
    return mentor.skills?.filter(s => s.type === "teach") || [];
  };

  const getLearnSkills = (mentor) => {
    return mentor.skills?.filter(s => s.type === "learn") || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Browse Skills
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Find people who want to learn what you know, and teach what you want to learn
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-12">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search for skills or mentors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Mentors Grid */}
        {filteredMentors.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No mentors found</h3>
            <p className="mt-2 text-gray-500">
              {mentors.length === 0 
                ? "No mentors available yet. Be the first to add your skills!" 
                : "Try searching for a different skill"
              }
            </p>
            <button 
              onClick={() => navigate("/profile")}
              className="mt-6 inline-block px-6 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white font-medium rounded-xl hover:shadow-lg transition-all"
            >
              Add Your Skills
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(100vh-320px)] pr-2 pb-4 custom-scrollbar">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMentors.map((mentor) => {
              const teachSkills = getTeachSkills(mentor);
              const learnSkills = getLearnSkills(mentor);
              const isOnline = mentor.isOnline === true;
              
              return (
                <div
                  key={mentor._id}
                  className="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300"
                >
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        {mentor.photo ? (
                          <img
                            src={mentor.photo}
                            alt={mentor.name}
                            className="w-16 h-16 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl">
                            {mentor.name ? mentor.name.charAt(0).toUpperCase() : "?"}
                          </div>
                        )}
                        {/* Online/Offline Status Indicator */}
                        <span 
                          className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                            isOnline ? "bg-green-500" : "bg-gray-400"
                          }`}
                          title={isOnline ? "Online" : "Offline"}
                        ></span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors">
                          {mentor.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          {isOnline ? (
                            <span className="text-xs text-green-600 font-medium">● Online</span>
                          ) : (
                            <span className="text-xs text-gray-500">● Offline</span>
                          )}
                          {mentor.trustScore > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              {mentor.trustScore}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="space-y-3 mb-4">
                      {teachSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Can Teach</p>
                          <div className="flex flex-wrap gap-1">
                            {teachSkills.map((skill, idx) => (
                              <span key={idx} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg">
                                {skill.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {learnSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-400 uppercase mb-1">Wants to Learn</p>
                          <div className="flex flex-wrap gap-1">
                            {learnSkills.map((skill, idx) => (
                              <span key={idx} className="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-lg">
                                {skill.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => handleRequestClick(mentor)}
                      disabled={!isOnline}
                      className={`w-full py-2.5 rounded-xl font-medium transition-all duration-300 ${
                        isOnline 
                          ? "bg-gradient-to-r from-primary to-indigo-600 text-white hover:shadow-lg"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {isOnline ? "Request Session" : "Currently Offline"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Request Session with {selectedMentor?.name}
            </h2>
            
            {requestSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-900">Request Sent!</p>
                <p className="text-gray-500">Redirecting to sessions...</p>
              </div>
            ) : (
              <form onSubmit={handleSendRequest}>
                {requestError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <p className="text-red-600 text-sm">{requestError}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Skill you want to learn
                  </label>
                  <select
                    value={requestForm.skill}
                    onChange={(e) => setRequestForm({ ...requestForm, skill: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="">Select a skill</option>
                    {getTeachSkills(selectedMentor).map((skill, idx) => (
                      <option key={idx} value={skill.name}>{skill.name}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    value={requestForm.date}
                    onChange={(e) => setRequestForm({ ...requestForm, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    value={requestForm.time}
                    onChange={(e) => setRequestForm({ ...requestForm, time: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingRequest}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-70"
                  >
                    {sendingRequest ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
