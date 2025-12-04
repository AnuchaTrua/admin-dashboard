// src/frontend/components/ActivityExplorer.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/** ================= Types ================= */

type WindowKey =
  | "all"
  | "7d"
  | "30d"
  | "90d"
  | "this_week"
  | "this_month"
  | "custom";

type ActivityRow = {
  id: number;
  user_id: number;
  name: string;
  type: "walk" | "bike";
  distance_km: number;
  carbon: number;
  pace_kmh: number | null;
  record_date: string; // ISO หรือ MySQL datetime
};

type UserSummary = {
  user_id: number;
  name: string;
  total_walk_km: number;
  total_bike_km: number;
  total_carbon: number;
  sessions: number;
};

type ApiList<T> = { success?: boolean; data?: T } | T;

/** ================= Helpers ================= */

function makeTimeParams(windowStr: WindowKey, from?: string, to?: string) {
  const params: any = {};
  if (windowStr === "custom") {
    if (from) params.from = from;
    if (to) params.to = to;
  } else {
    params.window = windowStr; // all, 7d, 30d, ...
  }
  return params;
}

/** Simple date → label helper */
const formatDateLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(); // แสดงตาม locale เครื่อง admin
};

/** Time window picker (เหมือน Dashboard) */
const WindowPicker = ({
  value,
  onChange,
  from,
  to,
  onFrom,
  onTo,
}: {
  value: WindowKey;
  onChange: (v: WindowKey) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <select
      className="px-2 py-1 rounded-lg text-sm bg-white border"
      value={value}
      onChange={(e) => onChange(e.target.value as WindowKey)}
    >
      <option value="all">All time</option>
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
      <option value="this_week">This week</option>
      <option value="this_month">This month</option>
      <option value="custom">Custom range</option>
    </select>
    {value === "custom" && (
      <>
        <input
          type="date"
          className="px-2 py-1 rounded-lg text-sm bg-white border"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
        />
        <span className="text-slate-400 text-xs">to</span>
        <input
          type="date"
          className="px-2 py-1 rounded-lg text-sm bg-white border"
          value={to}
          onChange={(e) => onTo(e.target.value)}
        />
      </>
    )}
  </div>
);

/** ================= Component ================= */

export default function ActivityExplorer() {
  const [userIdInput, setUserIdInput] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [windowKey, setWindowKey] = useState<WindowKey>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  /** กราฟ line: group by day (หรือ record_date ตรง ๆ) */
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; distance: number; carbon: number }>();
    for (const r of activities) {
      const dayKey = new Date(r.record_date).toISOString().slice(0, 10); // YYYY-MM-DD
      if (!map.has(dayKey)) {
        map.set(dayKey, { date: dayKey, distance: 0, carbon: 0 });
      }
      const cur = map.get(dayKey)!;
      cur.distance += r.distance_km;
      cur.carbon += r.carbon;
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [activities]);

  /** main fetch */
  const fetchData = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError(null);
    try {
      const timeParams = makeTimeParams(windowKey, fromDate, toDate);

      const [sumRes, actRes] = await Promise.all([
        api.get<ApiList<UserSummary>>("/api/admin/activity-explorer/summary", {
          params: { user_id: selectedUserId, ...timeParams },
        }),
        api.get<ApiList<ActivityRow[]>>("/api/admin/activity-explorer/list", {
          params: { user_id: selectedUserId, ...timeParams },
        }),
      ]);

      const sumData =
        (sumRes as any).data?.data ?? (sumRes as any).data ?? (sumRes as any);
      const actData =
        (actRes as any).data?.data ?? (actRes as any).data ?? (actRes as any);

      setSummary(sumData || null);
      setActivities(actData || []);
    } catch (e: any) {
      console.error("ActivityExplorer error:", e);
      setError(
        e?.response?.data?.message || "Failed to load user activities for this range"
      );
    } finally {
      setLoading(false);
    }
  };

  /** 🔥 จุดสำคัญ: ถ้าเปลี่ยน window / from / to จะยิง fetch ใหม่ */
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, windowKey, fromDate, toDate]);

  /** เมื่อกดปุ่ม load / search user */
  const handleLoadUser = () => {
    const idNum = Number(userIdInput);
    if (!idNum || Number.isNaN(idNum)) {
      setError("Please enter a valid numeric user_id");
      return;
    }
    setSelectedUserId(idNum);
  };

  return (
    <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="px-5 py-4 border-b flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            Activity Explorer (per user)
          </h3>
          <p className="text-xs text-slate-500">
            ดูกิจกรรม walk / bike ของผู้ใช้รายคน พร้อม filter ตามช่วงเวลา
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">User ID</span>
            <input
              type="number"
              className="px-2 py-1 rounded-lg text-sm bg-white border w-28"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="e.g. 12"
            />
            <button
              type="button"
              onClick={handleLoadUser}
              className="px-3 py-1 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
            >
              Load
            </button>
          </div>

          <WindowPicker
            value={windowKey}
            onChange={setWindowKey}
            from={fromDate}
            to={toDate}
            onFrom={setFromDate}
            onTo={setToDate}
          />
        </div>
      </div>

      <div className="p-5 space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
            {error}
          </div>
        )}

        {!selectedUserId && (
          <div className="text-sm text-slate-500">
            ใส่ <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              user_id
            </span>{" "}
            แล้วกด <span className="font-semibold">Load</span> เพื่อเริ่มดู activity
          </div>
        )}

        {selectedUserId && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  User
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-800">
                  {summary?.name ?? `ID ${selectedUserId}`}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  user_id: {selectedUserId}
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-100 bg-white">
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  Walk distance
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-800">
                  {(summary?.total_walk_km ?? 0).toFixed(1)} km
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-100 bg-white">
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  Bike distance
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-800">
                  {(summary?.total_bike_km ?? 0).toFixed(1)} km
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-slate-100 bg-white">
                <div className="text-xs text-slate-500 uppercase tracking-wide">
                  Carbon saved
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-800">
                  {(summary?.total_carbon ?? 0).toFixed(2)} kg CO₂e
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Sessions: {summary?.sessions ?? activities.length}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="h-72">
              <div className="mb-2 text-sm text-slate-600">
                Daily distance & carbon (ตาม filter วันที่)
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="distance"
                    name="Distance (km)"
                    stroke="#2563eb"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="carbon"
                    name="Carbon (kg CO₂e)"
                    stroke="#16a34a"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="mt-4">
              <div className="mb-2 text-sm text-slate-600">
                Activities list ({activities.length} records)
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600">
                      <th className="p-2 text-left">When</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-right">Distance (km)</th>
                      <th className="p-2 text-right">Carbon (kg CO₂e)</th>
                      <th className="p-2 text-right">Pace (km/h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-4 text-center text-slate-400"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!loading && activities.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-4 text-center text-slate-400"
                        >
                          No activities for this user in the selected period
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      activities.map((r) => (
                        <tr
                          key={r.id}
                          className="border-t hover:bg-slate-50/60"
                        >
                          <td className="p-2">
                            {formatDateLabel(r.record_date)}
                          </td>
                          <td className="p-2 capitalize">{r.type}</td>
                          <td className="p-2 text-right">
                            {r.distance_km.toFixed(1)}
                          </td>
                          <td className="p-2 text-right">
                            {r.carbon.toFixed(2)}
                          </td>
                          <td className="p-2 text-right">
                            {r.pace_kmh == null
                              ? "-"
                              : r.pace_kmh.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
