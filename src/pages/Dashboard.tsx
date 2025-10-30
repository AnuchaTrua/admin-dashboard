import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar, AreaChart, Area
} from 'recharts';

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
type DOWRow  = { dow: number; count: number };
type HistRow = { bin: number; count: number };
type LeaderRow = { user_id: number; name: string; total: number };

/** ================= Small UI Helpers ================= */
const Section = ({ title, right, children }:{
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
    <div className="px-5 py-4 flex items-center justify-between border-b">
      <h3 className="text-base md:text-lg font-semibold text-slate-800">{title}</h3>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const StatCard = ({ title, value, hint, icon, accent = 'blue' }:{
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: 'blue'|'emerald'|'violet'|'amber'|'rose'|'cyan';
}) => {
  const map: Record<string,string> = {
    blue:'bg-blue-50 text-blue-600', emerald:'bg-emerald-50 text-emerald-600',
    violet:'bg-violet-50 text-violet-600', amber:'bg-amber-50 text-amber-600',
    rose:'bg-rose-50 text-rose-600', cyan:'bg-cyan-50 text-cyan-600'
  };
  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-3">
        {icon && <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${map[accent]}`}>{icon}</div>}
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
          <div className="text-2xl font-bold mt-1 text-slate-800">{value}</div>
          {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
        </div>
      </div>
    </div>
  );
};

const SkeletonCard = ({ lines = 2 }:{lines?: number}) => (
  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse">
    <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
    <div className="h-8 bg-slate-200 rounded w-40 mb-2" />
    {Array.from({length:lines}).map((_,i)=>(
      <div className="h-3 bg-slate-200 rounded w-3/4 mb-2" key={i}/>
    ))}
  </div>
);

const TinySpark = ({ data }:{ data:{x:string|number;y:number}[] }) => (
  <ResponsiveContainer width="100%" height={40}>
    <AreaChart data={data}>
      <Area dataKey="y" stroke="#3b82f6" fill="#93c5fd" fillOpacity={0.3} />
    </AreaChart>
  </ResponsiveContainer>
);

/** ================= Page ================= */
export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // dynamic filters
  const [chartType, setChartType] = useState<'walk'|'bike'>('walk');
  const [lbWindow, setLbWindow] = useState<'7d'|'30d'|'90d'>('30d');
  const [lbMetric, setLbMetric] = useState<'carbon'|'distance'>('carbon');

  // insights data
  const [hourly, setHourly] = useState<HourRow[]>([]);
  const [weekday, setWeekday] = useState<DOWRow[]>([]);
  const [hist, setHist] = useState<HistRow[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dowToName = (dow:number) => weekdays[(dow - 1 + 7) % 7];

  const COLORS = useMemo(
    () => ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'],
    []
  );

  const fetchAll = async () => {
    setError(null);
    setLoading(true);
    try {
      const [sumRes, hourRes, dowRes, histRes, lbRes] = await Promise.all([
        api.get('/admin/summary'),
        api.get('/admin/insights/hourly',  { params: { type: chartType } }),
        api.get('/admin/insights/weekday', { params: { type: chartType } }),
        api.get('/admin/insights/distance_hist', { params: { type: chartType } }),
        api.get('/admin/insights/leaderboard', { params: { window: lbWindow, metric: lbMetric } }),
      ]);
      setSummary(sumRes.data?.data ?? null);
      setHourly(hourRes.data?.data ?? []);
      setWeekday(dowRes.data?.data ?? []);
      setHist(histRes.data?.data ?? []);
      setLeaders(lbRes.data?.data ?? []);
    } catch (e:any) {
      console.error('Dashboard load error:', e);
      setError(e?.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // initial
  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);
  // refetch when filters changed
  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [chartType, lbWindow, lbMetric]);

  const ov = summary?.overview;
  const act = summary?.activity;

  // mapping pies/bars
  const statusPie = (summary?.status_breakdown ?? []).map(s => ({
    name: s.status === 1 ? 'Active' : 'Blocked',
    value: s.count,
  }));
  const rolePie = (summary?.role_breakdown ?? []).map(r => ({
    name: r.role || '(unknown)',
    value: r.count,
  }));
  const vehicleBars = summary?.vehicle_distribution ?? [];
  const monthlyData = summary?.monthly_signups ?? [];
  const walkVsBike = [
    { name: 'Walk', value: act?.walk_count ?? 0 },
    { name: 'Bike', value: act?.bike_count ?? 0 },
  ];

  // tiny sparkline source
  const sparkData = monthlyData.map(d => ({ x: d.month, y: d.users }));

  return (
    <div className="space-y-6">
      {/* ===== Top Toolbar ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 text-sm">Overview, usage insights, and carbon reduction</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border rounded-xl px-2 py-1">
            <span className="text-xs text-slate-500">Charts</span>
            <button
              className={`px-3 py-1 rounded-lg text-sm ${chartType==='walk'?'bg-slate-900 text-white':'text-slate-700 hover:bg-slate-100'}`}
              onClick={()=>setChartType('walk')}
            >Walk</button>
            <button
              className={`px-3 py-1 rounded-lg text-sm ${chartType==='bike'?'bg-slate-900 text-white':'text-slate-700 hover:bg-slate-100'}`}
              onClick={()=>setChartType('bike')}
            >Bike</button>
          </div>

          <div className="flex items-center gap-2 bg-white border rounded-xl px-2 py-1">
            <span className="text-xs text-slate-500">Leaderboard</span>
            <select
              className="px-2 py-1 rounded-lg text-sm bg-transparent"
              value={lbWindow}
              onChange={(e)=>setLbWindow(e.target.value as any)}
            >
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
            <select
              className="px-2 py-1 rounded-lg text-sm bg-transparent"
              value={lbMetric}
              onChange={(e)=>setLbMetric(e.target.value as any)}
            >
              <option value="carbon">Carbon</option>
              <option value="distance">Distance</option>
            </select>
          </div>

          <button
            onClick={fetchAll}
            className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm hover:opacity-90 active:opacity-80"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ===== Error Notice ===== */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl">
          {error}
        </div>
      )}

      {/* ===== KPI + Sparkline ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        {loading && Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)}
        {!loading && (
          <>
            <StatCard title="Total Users"   value={ov?.total_users ?? 0} icon={<span>👥</span>} accent="blue"/>
            <StatCard title="Active Users"  value={ov?.active_users ?? 0} icon={<span>✅</span>} accent="emerald"/>
            <StatCard title="Blocked Users" value={ov?.blocked_users ?? 0} icon={<span>⛔</span>} accent="rose"/>
            <StatCard title="Admins"        value={ov?.admins ?? 0} icon={<span>🛡️</span>} accent="violet"/>
            <StatCard title="New (7d)"      value={ov?.new_7d ?? 0} icon={<span>✨</span>} accent="amber"/>
            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Growth Spark</div>
                  <div className="text-xs text-slate-400 mt-1">Signups (12m)</div>
                </div>
              </div>
              <div className="mt-2"><TinySpark data={sparkData}/></div>
            </div>
          </>
        )}
      </div>

      {/* ===== Carbon + Activity KPIs ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard/><SkeletonCard/><SkeletonCard/><SkeletonCard/>
          </>
        ) : (
          <>
            <StatCard title="Total Carbon Reduced" value={`${(act?.carbon_total_all ?? 0).toFixed(2)} kg CO₂e`} icon={<span>🌍</span>} accent="emerald"/>
            <StatCard title="Carbon (This Month)" value={`${(act?.carbon_total_month ?? 0).toFixed(2)} kg CO₂e`} icon={<span>📆</span>} accent="cyan"/>
            <StatCard title="Total Distance (All)" value={`${(act?.total_km_all ?? 0).toFixed(1)} km`} icon={<span>🛣️</span>} accent="blue"/>
            <StatCard title="Distance (This Month)" value={`${(act?.total_km_month ?? 0).toFixed(1)} km`} icon={<span>📅</span>} accent="violet"/>
          </>
        )}
      </div>

      {/* ===== Goals & Pace ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard/><SkeletonCard/><SkeletonCard/><SkeletonCard/>
          </>
        ) : (
          <>
            <StatCard title="Avg Walk / Activity" value={`${(act?.walk_avg_km ?? 0).toFixed(2)} km`} icon={<span>🚶</span>} accent="amber" hint="เฉลี่ยต่อครั้ง"/>
            <StatCard title="Avg Bike / Activity"  value={`${(act?.bike_avg_km ?? 0).toFixed(2)} km`} icon={<span>🚴</span>} accent="amber" hint="เฉลี่ยต่อครั้ง"/>
            <StatCard title="Avg Walk Pace" value={`${(act?.walk_avg_pace_kmh ?? 0).toFixed(2)} km/h`} icon={<span>⏱️</span>} accent="cyan"/>
            <StatCard title="Avg Bike Pace" value={`${(act?.bike_avg_pace_kmh ?? 0).toFixed(2)} km/h`} icon={<span>⚡</span>} accent="cyan"/>
          </>
        )}
      </div>

      {/* ===== Growth & Composition ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section title="User Growth (Last 12 months)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#2563eb" dot={false} strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="User Mix">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <div className="text-sm text-slate-600 mb-2">Status Breakdown</div>
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
              <div className="text-sm text-slate-600 mb-2">Role Breakdown</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary?.role_breakdown ?? []} dataKey="count" nameKey="role" outerRadius={90} label>
                    {(summary?.role_breakdown ?? []).map((_, i) => <Cell key={i} fill={COLORS[(i+3) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>
      </div>

      {/* ===== Activities & Vehicles ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section
          title={`Activities by Hour (${chartType === 'walk' ? 'Walk' : 'Bike'})`}
          right={
            <div className="text-xs text-slate-500">Best posting time ≈ peak usage</div>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={chartType==='walk' ? '#22c55e' : '#f59e0b'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Vehicle Distribution (Top 8)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vehicle" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* ===== Patterns & Split ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Section title={`Activities by Weekday (${chartType === 'walk' ? 'Walk' : 'Bike'})`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekday.map(r=>({ name: dowToName(r.dow), count: r.count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={chartType==='walk' ? '#3b82f6' : '#ef4444'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title={`Distance Histogram (${chartType === 'walk' ? 'Walk' : 'Bike'})`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bin" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={chartType==='walk' ? '#06b6d4' : '#84cc16'} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Activity Share (count)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{name:'Walk', value: act?.walk_count ?? 0},{name:'Bike', value: act?.bike_count ?? 0}]} dataKey="value" nameKey="name" outerRadius={100} label>
                  {[0,1].map((i) => <Cell key={i} fill={i===0 ? '#2563eb' : '#10b981'} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* ===== Leaderboard ===== */}
      <Section
        title={`Leaderboard — Top Users (${lbWindow}, by ${lbMetric})`}
        right={<div className="text-xs text-slate-500">* รวม Walk + Bike</div>}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">User</th>
                <th className="p-2 text-right">{lbMetric === 'carbon' ? 'Carbon (kg)' : 'Distance (km)'}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={3} className="p-4 text-center text-slate-400">Loading...</td></tr>
              )}
              {!loading && leaders.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-slate-400">No data</td></tr>
              )}
              {!loading && leaders.map((r, i) => (
                <tr key={r.user_id} className="border-t hover:bg-slate-50/60">
                  <td className="p-2">{i+1}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-right">
                    {lbMetric === 'carbon' ? r.total.toFixed(2) : r.total.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ===== Footer note ===== */}
      <div className="text-xs text-slate-400">
        Tips: ใช้ตัวกรอง “Charts: Walk/Bike” เพื่อสลับอินไซต์ของกราฟ และปรับ Leaderboard เป็น Carbon/Distance ได้จาก toolbar ด้านบน
      </div>
    </div>
  );
}
