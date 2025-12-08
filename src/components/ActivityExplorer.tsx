import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

type MinUser = { user_id: number; name: string; email: string };

type ActivityRow = {
  type: 'walk' | 'bike';
  id: number;
  record_date: string;
  distance_km: number;
  carbon: number;
  pace_kmh: number | null;
};

export default function ActivityExplorer() {
  const [users, setUsers] = useState<MinUser[]>([]);
  const [userId, setUserId] = useState<number | ''>('');
  const [userQuery, setUserQuery] = useState<string>('');
  const [type, setType] = useState<'all' | 'walk' | 'bike'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load lightweight user list
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

  const canSearch = useMemo(
    () => typeof userId === 'number' && userId > 0,
    [userId]
  );

  // Simple client-side search for users
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 20);
    return users
      .filter(u =>
        `${u.name} ${u.email}`.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [users, userQuery]);

  // ✅ แปลง YYYY-MM-DD ให้เป็นช่วงเวลาเต็มวัน
  const normalizeDateForQuery = (val: string, isEnd = false) => {
    if (!val) return undefined;
    // ถ้ามีเวลามาอยู่แล้ว (length > 10) ก็ปล่อยไป ไม่แตะ
    if (val.length > 10) return val;
    return isEnd ? `${val} 23:59:59` : `${val} 00:00:00`;
  };

  const search = async (goFirstPage = true, customOffset?: number) => {
    if (!canSearch) return;
    try {
      setLoading(true);

      const effectiveOffset = goFirstPage
        ? 0
        : (typeof customOffset === 'number' ? customOffset : offset);

      const params: Record<string, any> = {
        user_id: userId,
        type,
        limit,
        offset: effectiveOffset,
      };

      // ✅ ใช้ normalizeDateForQuery ก่อนส่งเข้า params
      const fromVal = normalizeDateForQuery(dateFrom, false);
      const toVal   = normalizeDateForQuery(dateTo, true);

      if (fromVal) params.date_from = fromVal;
      if (toVal) params.date_to = toVal;

      const res = await api.get('/admin/activity', { params });

      const raw: any[] = res.data?.data || [];

      // ✅ Map to safe numeric values, support both `carbon` and `carbonReduce`
      const mapped: ActivityRow[] = raw.map((r) => ({
        id: r.id,
        type: r.type,
        record_date: r.record_date,
        distance_km: Number(r.distance_km ?? 0),
        carbon: Number((r.carbon ?? r.carbonReduce) ?? 0),
        pace_kmh: r.pace_kmh == null ? null : Number(r.pace_kmh),
      }));

      setRows(mapped);

      const meta = res.data?.meta || res.data?.pagination || {
        total: mapped.length,
        limit,
        offset: effectiveOffset,
      };

      setTotal(meta.total ?? 0);
      setLimit(meta.limit ?? limit);
      setOffset(meta.offset ?? effectiveOffset);
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
      search(false, newOffset);
    }
  };

  const prevPage = () => {
    const newOffset = Math.max(0, offset - limit);
    search(false, newOffset);
  };

  const formatNumber = (val: number | null | undefined, digits = 2) => {
    if (typeof val !== 'number' || !Number.isFinite(val)) return '-';
    return val.toFixed(digits);
  };

  return (
    <div className="mt-8 p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-slate-800">Activity Explorer (per user)</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        {/* User search */}
        <div className="relative">
          <label className="block text-sm text-slate-600 mb-1">User</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Search by name or email"
            value={userQuery}
            onChange={(e) => {
              const val = e.target.value;
              setUserQuery(val);
              if (!val) {
                setUserId('');
              }
            }}
          />
          {filteredUsers.length > 0 && userQuery && (
            <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto border rounded bg-white shadow text-sm">
              {filteredUsers.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  className="w-full text-left px-3 py-1 hover:bg-slate-100"
                  onClick={() => {
                    setUserId(u.user_id);
                    setUserQuery(`${u.name} (${u.email})`);
                  }}
                >
                  {u.name} ({u.email})
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 text-[11px] text-slate-400">
            Select a user to query their activity history.
          </div>
        </div>

        {/* Type filter */}
        <div>
          <label className="block text-sm text-slate-600 mb-1">Activity type</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as 'all'|'walk'|'bike')}
          >
            <option value="all">All</option>
            <option value="walk">Walk only</option>
            <option value="bike">Bike only</option>
          </select>
        </div>

        {/* Date range (kept, default = all time when empty) */}
        <div>
          <label className="block text-sm text-slate-600 mb-1">Date from</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Date to</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <button
            disabled={!canSearch}
            onClick={() => search(true)}
            className="w-full px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
          >
            Search
          </button>
        </div>
      </div>

      {/* Results table */}
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="p-2">Type</th>
              <th className="p-2">ID</th>
              <th className="p-2">Record time</th>
              <th className="p-2">Distance (km)</th>
              <th className="p-2">Carbon reduced (kg CO₂e)</th>
              <th className="p-2">Pace (km/h)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={6}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3 text-slate-500" colSpan={6}>No data</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-t">
                  <td className="p-2 capitalize">{r.type}</td>
                  <td className="p-2">{r.id}</td>
                  <td className="p-2">{new Date(r.record_date).toLocaleString()}</td>
                  <td className="p-2">{formatNumber(r.distance_km, 2)}</td>
                  <td className="p-2">{formatNumber(r.carbon, 2)}</td>
                  <td className="p-2">{r.pace_kmh == null ? '-' : formatNumber(r.pace_kmh, 2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-slate-500">
          Total: {total} | Showing: {rows.length} | Offset: {offset}
        </div>
        <div className="space-x-2">
          <button
            onClick={prevPage}
            disabled={loading || offset === 0}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={nextPage}
            disabled={loading || offset + limit >= total}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
