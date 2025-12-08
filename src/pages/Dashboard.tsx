import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar, AreaChart, Area
} from 'recharts';
import {
  Users, UserCheck, UserX, ShieldCheck, UserPlus, Leaf, Flame,
  Calendar
} from 'lucide-react';
import ActivityExplorer from '../components/ActivityExplorer';

/** ================= Types ================= */
type Summary = {
  overview: {
    total_users: number;
    active_users: number;
    blocked_users: number;
    admins: number;
    new_7d: number;
    avg_household: number | null;
    avg_walk_goal: number | null;
    avg_bic_goal: number | null;
  };
  monthly_signups: { month: string; users: number }[];
  status_breakdown: { status: number; count: number }[];
  role_breakdown: { role: string; count: number }[];
  vehicle_distribution: { vehicle: string; count: number }[];
  activity: {
    walk_count: number;
    bike_count: number;
    total_km_all: number;
    total_km_month: number;
    walk_avg_km: number;
    bike_avg_km: number;
    walk_avg_pace_kmh: number;
    bike_avg_pace_kmh: number;
    carbon_total_all: number;
    carbon_total_month: number;
    active7: number;
    active30: number;
  }
};
type HourRow = { hour: number; count: number };
type DOWRow = { dow: number; count: number };
type HistRow = { bin: number; count: number };
type LeaderRow = { user_id: number; name: string; total: number };
type RecentRow = {
  id: number;
  user_id: number;
  name: string;
  type: 'walk' | 'bike' | 'rc_point' | 'e_point';
  distance_km: number;
  carbon: number;
  pace_kmh: number | null;
  record_date: string;
  activity_name?: string;
};
type Aggregates = { carbon_reduced: number; carbon_emitted: number };

/** ✅ Shared window key for all time filters */
type WindowKey = 'all' | '7d' | '30d' | '90d' | 'this_week' | 'this_month' | 'custom';

/** ================= Small UI Helpers ================= */
const Section = ({ title, subtitle, right, children }: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300 overflow-hidden">
    <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-50 gap-4">
      <div>
        <h3 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h3>
        {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const StatCard = ({ title, value, hint, icon, accent = 'blue', onClick, children, expanded }: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan';
  onClick?: () => void;
  children?: React.ReactNode;
  expanded?: boolean;
}) => {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100', emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100', amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100', cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-100'
  };
  return (
    <div
      className={`group bg-white rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' : ''} ${expanded ? 'ring-2 ring-blue-500/20' : ''}`}
      onClick={onClick}
    >
      <div className="p-5 flex items-start gap-4">
        {icon && (
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${map[accent]} group-hover:ring-4`}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-500 truncate">{title}</div>
          <div className="text-2xl font-bold mt-1 text-slate-800 tracking-tight">{value}</div>
          {hint && <div className="text-xs text-slate-400 mt-1 truncate">{hint}</div>}
        </div>
        {onClick && (
          <div className={`text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        )}
      </div>
      {expanded && children && (
        <div className="px-5 pb-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-200 cursor-default" onClick={e => e.stopPropagation()}>
          <div className="h-px bg-slate-100 mb-4" />
          {children}
        </div>
      )}
    </div>
  );
};

const CarbonBreakdown = ({ type, window, from, to }: { type: 'reduced' | 'emitted'; window: WindowKey; from: string; to: string }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecentRow[]>([]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = { limit: 10, ...makeTimeParams(window, from, to) };

        // ✅ Use specific ledger endpoint for reduced carbon
        if (type === 'reduced') {
          const res = await api.get('/admin/insights/ledger/reduced', { params });
          const raw = res.data?.data || [];
          // Map response to RecentRow structure
          const mapped = raw.map((r: any, i: number) => ({
            id: i,
            user_id: 0, // Not provided in ledger view
            name: r.user_name,
            type: r.type,
            distance_km: Number(r.distance_km || 0),
            carbon: Number(r.carbon_reduced || 0),
            pace_kmh: null,
            record_date: r.date,
            activity_name: r.activity
          }));
          setData(mapped);
        } else {
          // ✅ Use specific ledger endpoint for emitted carbon
          const res = await api.get('/admin/insights/ledger/emitted', { params });
          const raw = res.data?.data || [];
          const mapped = raw.map((r: any, i: number) => ({
            id: i,
            user_id: r.user_id || 0,
            name: r.user_name,
            type: 'e_point', // Explicitly set type as it might come as 'e_point' from API
            distance_km: Number(r.distance_km || 0),
            carbon: Number(r.carbon_emitted || 0),
            pace_kmh: null,
            record_date: r.date,
            activity_name: r.activity
          }));
          setData(mapped);
        }
      } catch (e) {
        console.error(e);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [type, window, from, to]);

  if (loading) return <div className="p-4 text-center text-sm text-slate-400">Loading ledger...</div>;
  if (data.length === 0) return <div className="p-4 text-center text-sm text-slate-400">No data available for this period</div>;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="px-4 py-3 font-medium whitespace-nowrap">Date</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">User</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Type</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Distance</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">
                {type === 'reduced' ? 'Reduced' : 'Emitted'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  <div className="font-medium text-slate-700">{new Date(r.record_date).toLocaleDateString()}</div>
                  <div className="text-xs text-slate-400">{new Date(r.record_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{r.name}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${r.type === 'walk'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : r.type === 'bike'
                      ? 'bg-amber-50 text-amber-700 border-amber-100'
                      : r.type === 'e_point'
                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                    {r.activity_name || (r.type === 'rc_point' ? 'Recycle' : r.type === 'e_point' ? 'Emission' : r.type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-600 whitespace-nowrap">
                  {r.distance_km > 0 ? (
                    <>{r.distance_km.toFixed(2)} <span className="text-xs text-slate-400">km</span></>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                  {r.carbon.toFixed(2)} <span className="text-xs text-slate-400">kg</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 px-4 py-2.5 text-xs text-center text-slate-500 border-t border-slate-200">
        Showing latest {data.length} records contributing to this total
      </div>
    </div>
  );
};

const SkeletonCard = ({ lines = 2 }: { lines?: number }) => (
  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse">
    <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
    <div className="h-8 bg-slate-200 rounded w-40 mb-2" />
    {Array.from({ length: lines }).map((_, i) => (
      <div className="h-3 bg-slate-200 rounded w-3/4 mb-2" key={i} />
    ))}
  </div>
);

const TinySpark = ({ data }: { data: { x: string | number; y: number }[] }) => (
  <ResponsiveContainer width="100%" height={40}>
    <AreaChart data={data}>
      <Area dataKey="y" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.3} />
    </AreaChart>
  </ResponsiveContainer>
);

/** ✅ makeTimeParams now supports 'all' as default */
function makeTimeParams(windowStr: WindowKey, from?: string, to?: string) {
  const params: any = {};
  if (windowStr === 'custom') {
    if (from) params.from = from;
    if (to) params.to = to;
  } else {
    params.window = windowStr; // includes 'all'
  }
  return params;
}

/** ================= Page ================= */
export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // ===== Charts filters =====
  const [chartType, setChartType] = useState<'walk' | 'bike'>('walk');
  const [chartWindow, setChartWindow] = useState<WindowKey>('all');
  const [chartFrom, setChartFrom] = useState<string>('');
  const [chartTo, setChartTo] = useState<string>('');

  // ===== Leaderboard filters =====
  const [lbWindow, setLbWindow] = useState<WindowKey>('all');
  const [lbMetric, setLbMetric] = useState<'carbon' | 'distance'>('carbon');
  const [lbFrom, setLbFrom] = useState<string>('');
  const [lbTo, setLbTo] = useState<string>('');

  // ===== Recent activities filters =====
  const [rcWindow, setRcWindow] = useState<WindowKey>('all');
  const [rcFrom, setRcFrom] = useState<string>('');
  const [rcTo, setRcTo] = useState<string>('');
  const [rcLimit, setRcLimit] = useState<number>(50);

  // ===== Carbon KPIs filters =====
  const [agWindow, setAgWindow] = useState<WindowKey>('all');
  const [agFrom, setAgFrom] = useState<string>('');
  const [agTo, setAgTo] = useState<string>('');
  const [aggregates, setAggregates] = useState<Aggregates>({ carbon_reduced: 0, carbon_emitted: 0 });
  const [expandedReduced, setExpandedReduced] = useState(false);
  const [expandedEmitted, setExpandedEmitted] = useState(false);

  // insights data
  const [hourly, setHourly] = useState<HourRow[]>([]);
  const [weekday, setWeekday] = useState<DOWRow[]>([]);
  const [hist, setHist] = useState<HistRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowToName = (dow: number) => weekdays[(dow - 1 + 7) % 7];

  const COLORS = useMemo(
    () => ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'],
    []
  );

  const fetchAll = async () => {
    setError(null);
    setLoading(true);
    try {
      // summary
      const sumReq = api.get('/admin/summary');

      // charts
      const chartParams = { type: chartType, ...makeTimeParams(chartWindow, chartFrom, chartTo) };
      const hourReq = api.get('/admin/insights/hourly', { params: chartParams });
      const dowReq = api.get('/admin/insights/weekday', { params: chartParams });
      const histReq = api.get('/admin/insights/distance_hist', { params: chartParams });

      // leaderboard
      const lbParams = { metric: lbMetric, ...makeTimeParams(lbWindow, lbFrom, lbTo) };
      const lbReq = api.get('/admin/insights/leaderboard', { params: lbParams });

      // recent activities
      const rcParams = { limit: rcLimit, ...makeTimeParams(rcWindow, rcFrom, rcTo) };
      const rcReq = api.get('/admin/recent-activities', { params: rcParams });

      // carbon aggregates
      const agParams = makeTimeParams(agWindow, agFrom, agTo);
      const agReq = api.get('/admin/insights/aggregates', { params: agParams });

      const [sumRes, hourRes, dowRes, histRes, lbRes, rcRes, agRes] =
        await Promise.all([sumReq, hourReq, dowReq, histReq, lbReq, rcReq, agReq]);

      setSummary(sumRes.data?.data ?? null);
      setHourly(hourRes.data?.data ?? []);
      setWeekday(dowRes.data?.data ?? []);
      setHist(histRes.data?.data ?? []);
      setLeaders(lbRes.data?.data ?? []);
      setRecent(rcRes.data?.data ?? []);
      setAggregates(agRes.data?.data ?? { carbon_reduced: 0, carbon_emitted: 0 });
    } catch (e: any) {
      console.error('Dashboard load error:', e);
      setError(e?.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, [
    chartType, chartWindow, chartFrom, chartTo,
    lbWindow, lbMetric, lbFrom, lbTo,
    rcWindow, rcFrom, rcTo, rcLimit,
    agWindow, agFrom, agTo
  ]);

  const ov = summary?.overview;
  const statusPie = (summary?.status_breakdown ?? []).map(s => ({
    name: s.status === 1 ? 'Active' : 'Blocked',
    value: s.count,
  }));
  const monthlyData = summary?.monthly_signups ?? [];
  const sparkData = monthlyData.map(d => ({ x: d.month, y: d.users }));

  /** ✅ Time window selector with "All time" as default option */
  const WindowPicker = ({
    value, onChange, from, to, onFrom, onTo
  }: {
    value: WindowKey; onChange: (v: WindowKey) => void;
    from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void;
  }) => (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          className="appearance-none pl-9 pr-8 py-1.5 rounded-lg text-sm bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer hover:border-slate-300 transition-colors"
          value={value}
          onChange={e => onChange(e.target.value as WindowKey)}
        >
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="this_week">This week</option>
          <option value="this_month">This month</option>
          <option value="custom">Custom range</option>
        </select>
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {value === 'custom' && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
          <input
            type="date"
            className="px-2 py-1.5 rounded-lg text-sm bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={from}
            onChange={e => onFrom(e.target.value)}
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            className="px-2 py-1.5 rounded-lg text-sm bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={to}
            onChange={e => onTo(e.target.value)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ===== Header ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 text-sm">
            Overview, usage insights, and carbon reduction from walking & cycling
          </p>
        </div>
      </div>

      {/* ===== Error Notice ===== */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl">
          {error}
        </div>
      )}

      {/* ===== TOP KPIs: Users ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        {!loading && (
          <>
            <StatCard
              title="Total users"
              value={ov?.total_users ?? 0}
              icon={<Users size={20} />}
              accent="blue"
              hint="All registered accounts"
            />
            <StatCard
              title="Active users"
              value={ov?.active_users ?? 0}
              icon={<UserCheck size={20} />}
              accent="emerald"
              hint="Status = active"
            />
            <StatCard
              title="Blocked users"
              value={ov?.blocked_users ?? 0}
              icon={<UserX size={20} />}
              accent="rose"
              hint="Status = blocked"
            />
            <StatCard
              title="Admins"
              value={ov?.admins ?? 0}
              icon={<ShieldCheck size={20} />}
              accent="violet"
              hint="Users with admin role"
            />
            <StatCard
              title="New users (7 days)"
              value={ov?.new_7d ?? 0}
              icon={<UserPlus size={20} />}
              accent="amber"
              hint="Accounts created in the last 7 days"
            />
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Growth spark</div>
              <div className="text-xs text-slate-400 mt-1">User signups (last 12 months)</div>
              <div className="mt-2"><TinySpark data={sparkData} /></div>
            </div>
          </>
        )}
      </div>

      {/* ===== Growth & Mix ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section
          title="User growth"
          subtitle="New accounts per month (last 12 months)"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#2563eb" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section
          title="User mix"
          subtitle="Account status and roles"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <div className="text-sm text-slate-600 mb-2">Status breakdown</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={90} label>
                    {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-64">
              <div className="text-sm text-slate-600 mb-2">Role breakdown</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary?.role_breakdown ?? []} dataKey="count" nameKey="role" outerRadius={90} label>
                    {(summary?.role_breakdown ?? []).map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>
      </div>

      {/* ===== Carbon KPIs (with time filter) ===== */}
      <Section
        title="Carbon KPIs"
        subtitle="Total carbon reduction and estimated emissions for the selected period"
        right={
          <WindowPicker
            value={agWindow}
            onChange={setAgWindow}
            from={agFrom}
            to={agTo}
            onFrom={setAgFrom}
            onTo={setAgTo}
          />
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          <StatCard
            title="Carbon reduced"
            value={`${aggregates.carbon_reduced.toFixed(2)} kg CO₂e`}
            icon={<Leaf size={20} />}
            accent="emerald"
            hint="From all activities (Click to see top contributors)"
            onClick={() => setExpandedReduced(!expandedReduced)}
            expanded={expandedReduced}
          >
            <CarbonBreakdown type="reduced" window={agWindow} from={agFrom} to={agTo} />
          </StatCard>
          <StatCard
            title="Carbon emitted"
            value={`${aggregates.carbon_emitted.toFixed(2)} kg CO₂e`}
            icon={<Flame size={20} />}
            accent="rose"
            hint="Baseline emissions (Click to see top contributors)"
            onClick={() => setExpandedEmitted(!expandedEmitted)}
            expanded={expandedEmitted}
          >
            <CarbonBreakdown type="emitted" window={agWindow} from={agFrom} to={agTo} />
          </StatCard>
        </div>
      </Section>

      {/* ===== Activity Charts (with filters) ===== */}
      <Section
        title={`Activity patterns — ${chartType === 'walk' ? 'Walking' : 'Cycling'}`}
        subtitle="Distribution of activities by hour of day, day of week, and distance"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-white border rounded-xl px-2 py-1">
              <span className="text-xs text-slate-500">Activity type</span>
              <button
                className={`px-3 py-1 rounded-lg text-sm ${chartType === 'walk' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                onClick={() => setChartType('walk')}
              >Walk</button>
              <button
                className={`px-3 py-1 rounded-lg text-sm ${chartType === 'bike' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                onClick={() => setChartType('bike')}
              >Bike</button>
            </div>
            <WindowPicker
              value={chartWindow}
              onChange={setChartWindow}
              from={chartFrom}
              to={chartTo}
              onFrom={setChartFrom}
              onTo={setChartTo}
            />
          </div>
        }
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="h-72">
            <div className="mb-2 text-sm text-slate-600">By hour of day</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={chartType === 'walk' ? '#22c55e' : '#f59e0b'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <div className="mb-2 text-sm text-slate-600">By weekday</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekday.map(r => ({ name: dowToName(r.dow), count: r.count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={chartType === 'walk' ? '#3b82f6' : '#ef4444'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <div className="mb-2 text-sm text-slate-600">Distance histogram</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bin" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={chartType === 'walk' ? '#06b6d4' : '#84cc16'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* ===== Leaderboard ===== */}
      <Section
        title={lbMetric === 'carbon' ? 'Carbon reduction leaderboard Top 10 Users' : 'Distance leaderboard Top 10 Users'}
        subtitle="Top users by total carbon saved or total distance"
        right={
          <div className="flex items-center gap-2">
            <select
              className="px-2 py-1 rounded-lg text-sm bg-white border"
              value={lbMetric}
              onChange={(e) => setLbMetric(e.target.value as any)}
            >
              <option value="carbon">Carbon</option>
              <option value="distance">Distance</option>
            </select>
            <WindowPicker
              value={lbWindow}
              onChange={setLbWindow}
              from={lbFrom}
              to={lbTo}
              onFrom={setLbFrom}
              onTo={setLbTo}
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-slate-600 border-b border-slate-100">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">
                  {lbMetric === 'carbon' ? 'Carbon (kg CO₂e)' : 'Distance (km)'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && <tr><td colSpan={3} className="p-8 text-center text-slate-400">Loading...</td></tr>}
              {!loading && leaders.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-400">No data</td></tr>}
              {!loading && leaders.map((r, i) => (
                <tr key={r.user_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{r.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {lbMetric === 'carbon' ? r.total.toFixed(2) : r.total.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ===== Recent Activities ===== */}
      <Section
        title="Recent activities"
        subtitle="Latest walk & bike records across the platform"
        right={
          <div className="flex items-center gap-2">

            <WindowPicker
              value={rcWindow}
              onChange={setRcWindow}
              from={rcFrom}
              to={rcTo}
              onFrom={setRcFrom}
              onTo={setRcTo}
            />
            <span className="text-xs text-slate-500">Rows</span>
            <input
              type="number"
              min={1}
              max={200}
              className="px-2 py-1 rounded-lg text-sm bg-white border w-20"
              value={rcLimit}
              onChange={(e) => setRcLimit(Math.max(1, Math.min(200, Number(e.target.value || 50))))}
              title="Limit"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-slate-600 border-b border-slate-100">
                <th className="px-4 py-3 text-left font-medium">When</th>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Distance (km)</th>
                <th className="px-4 py-3 text-right font-medium">Carbon (kg CO₂e)</th>
                <th className="px-4 py-3 text-right font-medium">Pace (km/h)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && <tr><td colSpan={6} className="p-8 text-center text-slate-400">Loading...</td></tr>}
              {!loading && recent.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No recent activities</td></tr>}
              {!loading && recent.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{new Date(r.record_date).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${r.type === 'walk' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">{r.distance_km.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">{r.carbon.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">{r.pace_kmh == null ? '-' : r.pace_kmh.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="text-xs text-slate-400">
        Tip: Each section has its own time filter (Carbon KPIs / Activity charts / Leaderboard / Recent activities).
      </div>

      <ActivityExplorer />
    </div>
  );
}
