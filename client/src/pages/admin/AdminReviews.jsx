import React, { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getReviews();
      setReviews(res.data.reviews || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, []);

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Reviews</h3>
      {loading ? <div>Loading...</div> : (
        <div className="space-y-4">
          {reviews.length === 0 && <div>No reviews yet.</div>}
          {reviews.map((r, i) => (
            <div key={i} className="p-4 border rounded">
              <div className="text-sm text-gray-600">From: {r.fromUser?.name || 'Unknown'} ({r.fromUser?.email || '—'})</div>
              <div className="text-sm text-gray-500">For User ID: {r.reviewedUser}</div>
              <div className="mt-2">Rating: <strong>{r.rating}</strong></div>
              <div className="mt-1 text-gray-700">{r.comment}</div>
              <div className="text-xs text-gray-400 mt-2">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
