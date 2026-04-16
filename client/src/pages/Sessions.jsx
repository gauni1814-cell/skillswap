import { useEffect, useState } from "react";

export default function MentorDashboard() {
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

    setSessions(data.filter((s) => s.status === "pending"));
  };

  useEffect(() => {
    const init = async () => {
      await fetchSessions();
    };
    init();
  }, []);

  const openModal = (session) => {
    setSelectedSession(session);
    setShowModal(true);
  };

  const scheduleSession = async () => {
    const token = localStorage.getItem("token");

    await fetch("/api/session/accept", {
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

    setShowModal(false);
    fetchSessions();
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Mentor Dashboard
      </h1>

      {sessions.map((session) => (
        <div
          key={session._id}
          className="bg-white shadow rounded-xl p-5 mb-4"
        >
          <h2 className="font-semibold text-xl">
            {session.learner?.name}
          </h2>

          <p>{session.skillTopic?.skillName}</p>

          <button
            onClick={() => openModal(session)}
            className="mt-3 px-5 py-2 bg-green-600 text-white rounded-lg"
          >
            Accept & Schedule
          </button>
        </div>
      ))}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <h2 className="text-xl font-bold mb-4">
              Schedule Session
            </h2>

            <input
              type="date"
              className="border p-2 w-full mb-3"
              onChange={(e) =>
                setForm({ ...form, date: e.target.value })
              }
            />

            <input
              type="time"
              className="border p-2 w-full mb-3"
              onChange={(e) =>
                setForm({ ...form, time: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Meeting Link"
              className="border p-2 w-full mb-3"
              onChange={(e) =>
                setForm({
                  ...form,
                  meetingLink: e.target.value
                })
              }
            />

            <button
              onClick={scheduleSession}
              className="w-full bg-blue-600 text-white py-2 rounded-lg"
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}