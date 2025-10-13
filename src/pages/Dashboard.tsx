import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

type SummaryResponse = {
  success: boolean;
  data: {
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
  }
};

function StatCard({ title, value, hint }: { title: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryResponse['data'] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/summary'); // ต้องแนบ Bearer token จาก api instance
        const data: SummaryResponse['data'] | undefined = res.data?.data;
        setSummary(data ?? null);
      } catch (err) {
        console.error('Dashboard summary error:', err);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const COLORS = useMemo(() => ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'], []);

  // Data mapping
  const monthlyData = summary?.monthly_signups ?? [];
  const statusPie = (summary?.status_breakdown ?? []).map(s => ({
    name: s.status === 1 ? 'Active' : 'Blocked',
    value: s.count,
  }));
  const rolePie = (summary?.role_breakdown ?? []).map(r => ({
    name: r.role || '(unknown)',
    value: r.count,
  }));
  const vehicleBars = summary?.vehicle_distribution ?? [];

  const ov = summary?.overview;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Overview & Insights</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        <StatCard title="Total Users" value={loading ? '...' : ov?.total_users ?? 0} />
        <StatCard title="Active Users" value={loading ? '...' : ov?.active_users ?? 0} />
        <StatCard title="Blocked Users" value={loading ? '...' : ov?.blocked_users ?? 0} />
        <StatCard title="Admins" value={loading ? '...' : ov?.admins ?? 0} />
        <StatCard title="New (7d)" value={loading ? '...' : ov?.new_7d ?? 0} />
        <StatCard
          title="Avg Household"
          value={loading ? '...' : (ov?.avg_household != null ? ov.avg_household.toFixed(1) : '-')}
        />
      </div>

      {/* Goals Averages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Avg Walk Goal"
          value={loading ? '...' : (ov?.avg_walk_goal != null ? ov.avg_walk_goal.toFixed(1) : '-')}
          hint="ค่าเฉลี่ยเป้าหมายการเดิน (ทุกผู้ใช้ที่ตั้งค่า)"
        />
        <StatCard
          title="Avg Bicycle Goal"
          value={loading ? '...' : (ov?.avg_bic_goal != null ? ov.avg_bic_goal.toFixed(1) : '-')}
          hint="ค่าเฉลี่ยเป้าหมายการปั่นจักรยาน (ทุกผู้ใช้ที่ตั้งค่า)"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Line: Monthly Signups */}
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-700 mb-3 font-semibold">User Growth (Last 12 months)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#2563eb" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie: Status breakdown */}
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-700 mb-3 font-semibold">Status Breakdown</div>
          <div className="h-64">
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
        </div>

        {/* Pie: Role breakdown */}
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-700 mb-3 font-semibold">Role Breakdown</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rolePie} dataKey="value" nameKey="name" outerRadius={90} label>
                  {rolePie.map((_, i) => <Cell key={i} fill={COLORS[(i+3) % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar: Vehicle distribution */}
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-700 mb-3 font-semibold">Vehicle Distribution (Top 8)</div>
          <div className="h-64">
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
        </div>
      </div>
    </div>
  );
}
