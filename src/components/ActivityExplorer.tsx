import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

type MinUser = { user_id: number; name: string; email: string };
type ActivityRow = {
  type: 'walk' | 'bike';
  id: number;
  record_date: string;
  distance_km: number | null;
  carbonReduce: number | null;
  duration_sec: number | null;
  step_total: number | null; // walk เท่านั้น
  title: string | null;
  description: string | null;
};

export default function ActivityExplorer() {
  const [users, setUsers] = useState<MinUser[]>([]);
  const [userId, setUserId] = useState<number | ''>('');
  const [type, setType] = useState<'all' | 'walk' | 'bike'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // โหลดรายชื่อ user แบบเบา
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await api.get('/admin/users/min');
        const list: MinUser[] = res.data?.data || [];
        setUsers(list);
      } catch (err) {
        console.error('load min users error', err);
      }
    };
    loadUsers();
  }, []);

  const canSearch = useMemo(() => typeof userId === 'number', [userId]);

  const search = async (goFirstPage = true) => {
    if (!canSearch) return;
    try {
      setLoading(true);
      const params: Record<string, any> = {
        user_id: userId,
        type,
        limit,
        offset: goFirstPage ? 0 : offset,
      };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get('/admin/activity', { params });
      setRows(res.data?.data || []);
      const pg = res.data?.pagination || { total: 0, limit, offset: 0 };
      setTotal(pg.total);
      setLimit(pg.limit);
      setOffset(pg.offset);
    } catch (err) {
      console.error('activity search error', err);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const nextPage = () => {
    const newOffset = offset + limit;
    if (newOffset < total) {
      setOffset(newOffset);
      // คง filter เดิม เดินหน้าเพจต่อ
      search(false);
    }
  };
  const prevPage = () => {
    const newOffset = Math.max(0, offset - limit);
    setOffset(newOffset);
    search(false);
  };

  return (
    <div className="mt-8 p-4 bg-white rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-gray-700">Activity Explorer (per user)</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">User</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={userId === '' ? '' : String(userId)}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">-- เลือกผู้ใช้ --</option>
            {users.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Type</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={type}
            onChange={(e) => setType(e.target.value as 'all'|'walk'|'bike')}
          >
            <option value="all">all</option>
            <option value="walk">walk</option>
            <option value="bike">bike</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Date from</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Date to</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            disabled={!canSearch}
            onClick={() => search(true)}
            className="w-full px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </div>

      {/* ตารางผลลัพธ์ */}
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">Type</th>
              <th className="p-2">ID</th>
              <th className="p-2">Record Date</th>
              <th className="p-2">Title</th>
              <th className="p-2">Distance (km)</th>
              <th className="p-2">Carbon Reduce</th>
              <th className="p-2">Duration (sec)</th>
              <th className="p-2">Step</th>
              <th className="p-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={9}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3 text-gray-500" colSpan={9}>No data</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-t">
                  <td className="p-2 capitalize">{r.type}</td>
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{new Date(r.record_date).toLocaleString()}</td>
                  <td className="p-2">{r.title || '-'}</td>
                  <td className="p-2">{r.distance_km ?? '-'}</td>
                  <td className="p-2">{r.carbonReduce ?? '-'}</td>
                  <td className="p-2">{r.duration_sec ?? '-'}</td>
                  <td className="p-2">{r.type === 'walk' ? (r.step_total ?? '-') : '-'}</td>
                  <td className="p-2">{r.description || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-500">
          Total: {total} | Showing {rows.length} | Offset {offset}
        </div>
        <div className="space-x-2">
          <button
            onClick={prevPage}
            disabled={loading || offset === 0}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={nextPage}
            disabled={loading || offset + limit >= total}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
