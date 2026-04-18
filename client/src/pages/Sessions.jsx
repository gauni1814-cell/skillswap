import { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import { useAuth } from "../context/AuthContext";

export default function Sessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  const [form, setForm] = useState({
    date: "",
    time: "",
    meetingLink: ""
  });

  const fetchSessions = async () => {
    const token = localStorage.getItem("token");

    const res = await fetch("/api/session", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();

    // Show different views depending on role
    if (user && user.role === 'mentor') {
      // Mentors should see incoming pending requests assigned to them
      setSessions(Array.isArray(data) ? data.filter((s) => s.status === "pending" && String(s.mentor?._id || s.mentor) === String(user._id)) : []);
    } else {
      // Learners see their own sessions (scheduled/upcoming)
      setSessions(Array.isArray(data) ? data.filter((s) => String(s.learner?._id || s.learner) === String(user?._id)) : []);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchSessions();
    };
    // Wait for user to be available (AuthProvider may load asynchronously)
    if (!user) return;
    init();
  }, [user]);

  const openModal = async (session) => {
    // Used by mentors to accept a pending request and open scheduling modal
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/session/accept-request', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: session._id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data && (data.msg || data.error || data.message) ? (data.msg || data.error || data.message) : 'Failed to accept request';
        toast.error(msg);
        return;
      }
      const returned = data.session || session;
      setSelectedSession(returned);
      // Prefill a generated meeting link so mentor can confirm or edit
      const gen = (() => {
        const rand = (n) => Math.random().toString(36).substring(2, 2 + n);
        return `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}`;
      })();
      setForm(f => ({ ...f, meetingLink: gen }));
      toast.success('Request accepted — please schedule a time');
      setShowModal(true);
    } catch (err) {
      console.error('Error accepting request', err);
      toast.error('Failed to accept request');
    }
  };

  const scheduleSession = async () => {
    const token = localStorage.getItem("token");

    // Client-side validation: ensure date/time selected and in future
    if (!form.date || !form.time) {
      toast.error('Please select date and time');
      return;
    }
    const selected = new Date(`${form.date}T${form.time}`);
    if (isNaN(selected.getTime()) || selected <= new Date()) {
      toast.error('Please select a future date and time');
      return;
    }

    try {
      const res = await fetch("/api/session/accept", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: selectedSession._id,
          date: form.date,
          time: form.time,
          meetingLink: form.meetingLink
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.msg || 'Failed to schedule');
      }

      toast.success('Session scheduled');
      setShowModal(false);
      fetchSessions();
    } catch (err) {
      console.error('Schedule error', err);
      toast.error(err.message || 'Failed to schedule session');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Sessions
      </h1>

      {user && user.role === 'mentor' ? (
        // Mentor view: show incoming pending requests
        <div>
          {sessions.length === 0 ? (
            <div className="text-slate-600">No pending requests.</div>
          ) : (
            sessions.map((session) => (
              <div key={session._id} className="bg-white shadow rounded-xl p-5 mb-4">
                <h2 className="font-semibold text-xl">{session.learner?.name}</h2>
                <p>{session.skillTopic?.skillName}</p>
                <button onClick={() => openModal(session)} className="mt-3 px-5 py-2 bg-green-600 text-white rounded-lg">Accept & Schedule</button>
              </div>
            ))
          )}
        </div>
      ) : (
        // Learner view: show own scheduled/upcoming sessions
        <div>
          {sessions.length === 0 ? (
            <div className="text-slate-600">No sessions found.</div>
          ) : (
            sessions.map((session) => (
              <div key={session._id} className="bg-white shadow rounded-xl p-5 mb-4">
                <h2 className="font-semibold text-xl">{session.mentor?.name}</h2>
                <p>{session.skillTopic?.skillName}</p>
                <p className="text-sm text-slate-600">Status: {session.status}</p>
                <p className="text-sm text-slate-600">Scheduled: {session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : 'TBD'}</p>
                {session.status === 'scheduled' && session.meetingLink && (
                  <div className="flex gap-2 mt-3">
                    <button 
                      onClick={() => window.open(session.meetingLink, '_blank')} 
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Join Session
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(session.meetingLink);
                        toast.success('Meeting link copied to clipboard');
                      }}
                      className="px-5 py-2 bg-slate-300 text-slate-800 rounded-lg hover:bg-slate-400 transition"
                    >
                      Copy Link
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <h2 className="text-xl font-bold mb-4">Schedule Session</h2>

            <input type="date" value={form.date} min={new Date().toISOString().split('T')[0]} className="border p-2 w-full mb-3" onChange={(e) => setForm({ ...form, date: e.target.value })} />

            <input type="time" value={form.time} className="border p-2 w-full mb-3" onChange={(e) => setForm({ ...form, time: e.target.value })} />

            <input type="text" placeholder="Meeting Link" value={form.meetingLink} className="border p-2 w-full mb-3" onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} />

            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-slate-200 rounded">Cancel</button>
              <button onClick={scheduleSession} className="flex-1 w-full bg-blue-600 text-white py-2 rounded-lg">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}