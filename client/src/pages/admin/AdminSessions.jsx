import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';

const AdminSessions = () => {
  const [sessions, setSessions] = useState([]);

  const fetch = async () => {
    try {
      const res = await adminAPI.listSessions();
      setSessions(res.data.sessions || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetch(); }, []);

  const cancel = async (id) => {
    if (!confirm('Force cancel this session?')) return;
    try { await adminAPI.cancelSession(id); fetch(); } catch (err) { console.error(err); }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Sessions</h3>
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left text-sm text-gray-600">
              <th className="py-2 px-3">Learner</th>
              <th className="py-2 px-3">Mentor</th>
              <th className="py-2 px-3">Skill</th>
              <th className="py-2 px-3">Scheduled</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s._id} className="border-t">
                <td className="py-3 px-3">{s.learner?.name}</td>
                <td className="py-3 px-3">{s.mentor?.name}</td>
                <td className="py-3 px-3">{s.skillTopic?.skillName}</td>
                <td className="py-3 px-3">{s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '—'}</td>
                <td className="py-3 px-3">{s.status}</td>
                <td className="py-3 px-3"><button onClick={() => cancel(s._id)} className="px-3 py-1 rounded bg-red-500 text-white text-sm">Force Cancel</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminSessions;
