import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Dashboard() {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/users'); // ต้องเป็น token ของ admin
        setTotalUsers(Array.isArray(res.data) ? res.data.length : null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Overview</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Total Users</div>
          <div className="text-2xl font-bold">{loading ? 'Loading...' : totalUsers ?? '-'}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Carbon stats</div>
          <div className="text-2xl font-bold">--</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Points / Rewards</div>
          <div className="text-2xl font-bold">--</div>
        </div>
      </div>
    </div>
  );
}
