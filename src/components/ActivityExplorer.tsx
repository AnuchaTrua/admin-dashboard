import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
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
      const toVal = normalizeDateForQuery(dateTo, true);

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
    <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-50">
        <div className="flex items-center gap-2 font-bold text-lg text-slate-800 tracking-tight">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Activity size={20} />
          </div>
          <span>Activity Explorer (per user)</span>
        </div>
      </div>

      <div className="p-6">

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {/* User search */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">User</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
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
              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto border border-slate-100 rounded-xl bg-white shadow-lg text-sm">
                {filteredUsers.map((u) => (
                  <button
                    key={u.user_id}
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors text-slate-700"
                    onClick={() => {
                      setUserId(u.user_id);
                      setUserQuery(`${u.name} (${u.email})`);
                    }}
                  >
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Activity type</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
              value={type}
              onChange={(e) => setType(e.target.value as 'all' | 'walk' | 'bike')}
            >
              <option value="all">All Activities</option>
              <option value="walk">Walk only</option>
              <option value="bike">Bike only</option>
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Date from</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-600"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Date to</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-600"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              disabled={!canSearch}
              onClick={() => search(true)}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={18} />}
              <span>{loading ? 'Searching...' : 'Search'}</span>
            </button>
          </div>
        </div>

        {/* Results table */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-left text-slate-600 border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Record time</th>
                <th className="px-4 py-3 font-medium text-right">Distance (km)</th>
                <th className="px-4 py-3 font-medium text-right">Carbon (kg CO₂e)</th>
                <th className="px-4 py-3 font-medium text-right">Pace (km/h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="p-8 text-center text-slate-400" colSpan={6}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="p-8 text-center text-slate-400" colSpan={6}>No data found</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.type}-${r.id}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${r.type === 'walk' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">#{r.id}</td>
                    <td className="px-4 py-3 text-slate-700">{new Date(r.record_date).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{formatNumber(r.distance_km, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{formatNumber(r.carbon, 2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{r.pace_kmh == null ? '-' : formatNumber(r.pace_kmh, 2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-4">
          <div className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{rows.length}</span> results (Total: {total})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevPage}
              disabled={loading || offset === 0}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>
            <button
              onClick={nextPage}
              disabled={loading || offset + limit >= total}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
