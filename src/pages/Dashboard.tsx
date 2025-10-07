import React, { useEffect, useState } from 'react';
import api from '../services/api';

type User = {
  user_id: number;
  status: number; // 0/1
  // ...ถ้าจะใช้คำนวณเพิ่ม ให้ใส่ field ที่ต้องการได้
};

export default function Dashboard() {
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [blockedUsers, setBlockedUsers] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/users'); // ต้องส่ง token ของ admin อยู่แล้วจาก api instance
        // รองรับทั้งกรณี array ตรง ๆ และ { data: [...] }
        const payload: User[] = Array.isArray(res.data) ? res.data : res.data?.data || [];

        const total = payload.length;
        const active = payload.filter(u => Number(u.status) === 1).length;
        const blocked = total - active;

        setTotalUsers(total);
        setActiveUsers(active);
        setBlockedUsers(blocked);
      } catch (err) {
        console.error('Dashboard load error:', err);
        setTotalUsers(0);
        setActiveUsers(0);
        setBlockedUsers(0);
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
          <div className="text-2xl font-bold">{loading ? 'Loading...' : totalUsers}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Active Users</div>
          <div className="text-2xl font-bold">{loading ? 'Loading...' : activeUsers}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Blocked Users</div>
          <div className="text-2xl font-bold">{loading ? 'Loading...' : blockedUsers}</div>
        </div>
      </div>
    </div>
  );
}
