import { useEffect, useMemo, useRef, useState } from "react";
import {
  Edit2,
  Trash2,
  Plus,
  X,
  Search,
  Power,
  PowerOff,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  History,
} from "lucide-react";
import api from "../services/api";

/* ---------- Types ---------- */
export type Reward = {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  cost_points: number;
  start_at: string | null; // 'YYYY-MM-DD HH:MM:SS' or null
  expires_at: string | null; // 'YYYY-MM-DD HH:MM:SS' or null
  active: 0 | 1;
  stock: number;
  created_at?: string;
  updated_at?: string;
};

export type RedemptionStatus =
  | "pending"
  | "approved"
  | "used"
  | "expired"
  | "rejected"
  | "cancelled";

export type RewardRedemption = {
  id: number; // BIGINT(20) (ยังใช้ number ตามของเดิม)
  user_id: number;
  reward_id: number;
  cost_points: number;
  status: RedemptionStatus;
  created_at: string; // DATETIME
  voucher_code: string | null;
  qr_payload: string | null;
  qr_image_url: string | null;
  expires_at: string | null; // DATETIME
  used_at: string | null; // DATETIME
  // joined fields (from API)
  user_name?: string | null;
  user_email?: string | null;
  reward_title?: string | null;
};

type ApiList<T> = { success?: boolean; data?: T } | T;

/* ---------- Helpers ---------- */
const toMySQLDateTime = (val: string | null): string | null => {
  if (!val) return null;
  const [d, t] = val.split("T");
  if (!d || !t) return null;
  return `${d} ${t}:00`;
};

const toLocalInputValue = (mysqlDT?: string | null): string => {
  if (!mysqlDT) return "";
  const [d, t] = mysqlDT.split(" ");
  if (!d || !t) return "";
  const [hh, mm] = t.split(":");
  return `${d}T${hh}:${mm}`;
};

const fmtDT = (val?: string | null) => {
  if (!val) return "-";
  return val; // keep stable (DB string)
};

const StatusBadge = ({ active }: { active: 0 | 1 }) => (
  <span
    className={`px-2 py-0.5 rounded text-xs ${
      active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
    }`}
  >
    {active ? "Active" : "Inactive"}
  </span>
);

const RedemptionBadge = ({ status }: { status: RedemptionStatus }) => {
  const cls =
    status === "approved"
      ? "bg-blue-100 text-blue-700"
      : status === "used"
      ? "bg-emerald-100 text-emerald-700"
      : status === "expired"
      ? "bg-gray-200 text-gray-700"
      : status === "rejected"
      ? "bg-rose-100 text-rose-700"
      : status === "cancelled"
      ? "bg-slate-200 text-slate-700"
      : "bg-amber-100 text-amber-800"; // pending

  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{status}</span>;
};

/* ---------- Confirm Dialog ---------- */
function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
        <div className="border-b px-6 py-3">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="px-6 py-4 text-sm text-gray-700">{message}</div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button className="rounded border px-4 py-2" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="rounded bg-red-600 px-4 py-2 text-white"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Create / Edit Modal (with S3 upload) ---------- */
function RewardFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Reward>) => Promise<void>;
  initial?: Reward | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointCost, setPointCost] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [active, setActive] = useState<0 | 1>(1);
  const [startAtInput, setStartAtInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");

  // image state
  const [imageUrl, setImageUrl] = useState<string>("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setTitle(initial.title ?? "");
      setDescription(initial.description ?? "");
      setPointCost(
        Number.isFinite(initial.cost_points) ? initial.cost_points : ""
      );
      setStock(Number.isFinite(initial.stock) ? initial.stock : "");
      setActive(initial.active ?? 1);
      setStartAtInput(toLocalInputValue(initial.start_at));
      setExpiresAtInput(toLocalInputValue(initial.expires_at));
      setImageUrl(initial.image_url ?? "");
      setFileObj(null);
      setPreview(initial.image_url ?? "");
    } else {
      setTitle("");
      setDescription("");
      setPointCost("");
      setStock("");
      setActive(1);
      setStartAtInput("");
      setExpiresAtInput("");
      setImageUrl("");
      setFileObj(null);
      setPreview("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFileObj(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(imageUrl || "");
    }
  };

  const uploadToS3 = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post("/admin/rewards/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const url = res?.data?.url as string;
    if (!url) throw new Error("Upload failed");
    return url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return alert("Please enter reward name.");
    if (pointCost === "" || Number(pointCost) < 0)
      return alert("Please enter a valid point value.");
    if (stock === "" || Number(stock) < 0)
      return alert("Please enter a valid stock quantity.");

    let finalImageUrl = imageUrl || null;

    // If new file selected → upload to S3 → use new URL
    if (fileObj) {
      try {
        finalImageUrl = await uploadToS3(fileObj);
      } catch (err) {
        console.error("upload error:", err);
        alert("Image upload failed.");
        return;
      }
    }

    await onSubmit({
      title: title.trim().slice(0, 120),
      description,
      image_url: finalImageUrl,
      cost_points: Number(pointCost), // backend field stays cost_points
      stock: Number(stock),
      active,
      start_at: toMySQLDateTime(startAtInput),
      expires_at: toMySQLDateTime(expiresAtInput),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b bg-gray-50/50 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-gray-800">
            {initial ? "Edit Reward" : "Create New Reward"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Reward name (max 120)
              </label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="e.g. 50% Off Coupon"
                required
              />
            </div>

            {/* point */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Point
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={pointCost}
                onChange={(e) =>
                  setPointCost(e.target.value === "" ? "" : Number(e.target.value))
                }
                min={0}
                placeholder="e.g. 100"
                required
              />
              <div className="text-xs text-gray-400">
                (ระบบหลังบ้านยังเก็บ field เป็น <code>cost_points</code> เหมือนเดิม)
              </div>
            </div>

            {/* stock */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Stock
              </label>
              <input
                type="number"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={stock}
                onChange={(e) =>
                  setStock(e.target.value === "" ? "" : Number(e.target.value))
                }
                min={0}
                placeholder="e.g. 50"
                required
              />
            </div>

            {/* active */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                value={active}
                onChange={(e) => setActive(Number(e.target.value) ? 1 : 0)}
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>

            {/* start_at */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Start (optional)
              </label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={startAtInput}
                onChange={(e) => setStartAtInput(e.target.value)}
              />
            </div>

            {/* expires_at */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Expires (optional)
              </label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={expiresAtInput}
                onChange={(e) => setExpiresAtInput(e.target.value)}
              />
            </div>
          </div>

          {/* description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              className="w-full min-h-[110px] px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reward details..."
            />
          </div>

          {/* image */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Reward image (optional)
            </label>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="w-full md:w-[240px] h-[160px] rounded-xl border bg-gray-50 overflow-hidden flex items-center justify-center">
                {preview ? (
                  <img
                    src={preview}
                    className="w-full h-full object-cover"
                    alt="preview"
                  />
                ) : (
                  <div className="text-gray-400 flex items-center gap-2 text-sm">
                    <ImageIcon size={18} />
                    No image
                  </div>
                )}
              </div>

              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                  >
                    <Upload size={16} />
                    Choose file
                  </button>

                  {!!imageUrl && !fileObj && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl("");
                        setPreview("");
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                      title="Remove current image"
                    >
                      <X size={16} />
                      Remove
                    </button>
                  )}

                  {fileObj && (
                    <div className="text-sm text-gray-500">
                      Selected: <span className="font-medium">{fileObj.name}</span>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-400 mt-2">
                  อัปโหลดไปที่ <code>/admin/rewards/upload</code> แล้วได้ URL กลับมาเก็บใน{" "}
                  <code>image_url</code>
                </div>
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function PointManagement() {
  // rewards
  const [list, setList] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [openDelete, setOpenDelete] = useState<Reward | null>(null);
  const [q, setQ] = useState("");

  // redemptions
  const [rLoading, setRLoading] = useState(false);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [rQ, setRQ] = useState("");
  const [rStatus, setRStatus] = useState<"all" | RedemptionStatus>("all");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter(
      (r) =>
        r.title.toLowerCase().includes(keyword) ||
        (r.description || "").toLowerCase().includes(keyword)
    );
  }, [q, list]);

  const filteredRedemptions = useMemo(() => {
    const keyword = rQ.trim().toLowerCase();

    return redemptions.filter((rr) => {
      if (rStatus !== "all" && rr.status !== rStatus) return false;
      if (!keyword) return true;

      const hay = [
        rr.id,
        rr.user_id,
        rr.reward_id,
        rr.cost_points,
        rr.status,
        rr.voucher_code || "",
        rr.qr_payload || "",
        rr.user_name || "",
        rr.user_email || "",
        rr.reward_title || "",
        rr.created_at || "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(keyword);
    });
  }, [redemptions, rQ, rStatus]);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/rewards");
      const data = res.data as ApiList<Reward[]>;
      const rows = Array.isArray(data) ? data : data?.data || [];
      setList(rows);
    } catch (err) {
      console.error("fetch rewards error:", err);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRedemptions = async () => {
    try {
      setRLoading(true);
      const params: any = { limit: 200, offset: 0 };
      if (rStatus !== "all") params.status = rStatus;

      const res = await api.get("/admin/rewards/redemptions", { params });
      const data = res.data as ApiList<RewardRedemption[]>;
      const rows = Array.isArray(data) ? data : data?.data || [];
      setRedemptions(rows);
    } catch (err) {
      console.error("fetch redemptions error:", err);
      setRedemptions([]);
    } finally {
      setRLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
    fetchRedemptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRedemptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rStatus]);

  const handleCreate = async (payload: Partial<Reward>) => {
    await api.post("/admin/rewards", payload);
    await fetchRewards();
  };

  const handleUpdate = async (id: number, payload: Partial<Reward>) => {
    await api.put(`/admin/rewards/${id}`, payload);
    await fetchRewards();
  };

  const handleDelete = async () => {
    if (!openDelete) return;
    await api.delete(`/admin/rewards/${openDelete.id}`);
    setOpenDelete(null);
    await fetchRewards();
  };

  const toggleActive = async (r: Reward) => {
    await api.patch(`/admin/rewards/${r.id}/toggle`);
    await fetchRewards();
  };

  return (
    <div className="p-6 space-y-8">
      {/* ===== Rewards ===== */}
      <div>
        <div className="mb-4 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold">Reward Management</h1>
            <p className="text-sm text-gray-500">
              Manage rewards for the carbon point system.
            </p>
          </div>
          <div className="flex w-full items-center gap-3 md:w-auto">
            <div className="relative w-full md:w-64">
              <input
                className="w-full rounded border pl-9 pr-3 py-2"
                placeholder="Search rewards…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setOpenForm(true);
              }}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              <span>New Reward</span>
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Reward</th>
                  <th className="p-3">Point</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Start</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="p-4 text-center text-gray-500" colSpan={8}>
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="p-4 text-center text-gray-500" colSpan={8}>
                      No rewards found
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3">{r.id}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                            {r.image_url ? (
                              <img
                                src={r.image_url}
                                alt={r.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                                no image
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{r.title}</div>
                            <div className="line-clamp-2 max-w-[40ch] text-xs text-gray-500">
                              {r.description || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{r.cost_points.toLocaleString()}</td>
                      <td className="p-3">{r.stock}</td>
                      <td className="p-3">{r.start_at ?? "-"}</td>
                      <td className="p-3">{r.expires_at ?? "-"}</td>
                      <td className="p-3">
                        <StatusBadge active={r.active} />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className={`p-1.5 rounded border transition-colors ${
                              r.active
                                ? "text-amber-600 border-amber-200 hover:bg-amber-50"
                                : "text-green-600 border-green-200 hover:bg-green-50"
                            }`}
                            onClick={() => toggleActive(r)}
                            title={r.active ? "Deactivate" : "Activate"}
                          >
                            {r.active ? (
                              <PowerOff size={16} />
                            ) : (
                              <Power size={16} />
                            )}
                          </button>

                          <button
                            className="p-1.5 rounded border text-blue-600 border-blue-200 hover:bg-blue-50 transition-colors"
                            onClick={() => {
                              setEditing(r);
                              setOpenForm(true);
                            }}
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            className="p-1.5 rounded border text-red-600 border-red-200 hover:bg-red-50 transition-colors"
                            onClick={() => setOpenDelete(r)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <RewardFormModal
          open={openForm}
          onClose={() => setOpenForm(false)}
          onSubmit={async (payload) => {
            if (editing) await handleUpdate(editing.id, payload);
            else await handleCreate(payload);
          }}
          initial={editing}
        />

        <ConfirmDialog
          open={!!openDelete}
          title="Delete reward?"
          message={`Are you sure you want to delete "${openDelete?.title}"?`}
          onCancel={() => setOpenDelete(null)}
          onConfirm={handleDelete}
        />
      </div>

      {/* ===== Redemption History ===== */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-gray-600" />
            <div>
              <div className="font-semibold">Reward Redemption History</div>
              <div className="text-xs text-gray-500">
                View redemption records from <code>reward_redemption</code>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
            <div className="relative w-full md:w-72">
              <input
                className="w-full rounded border pl-9 pr-3 py-2 text-sm"
                placeholder="Search (id/user/reward/voucher/status)..."
                value={rQ}
                onChange={(e) => setRQ(e.target.value)}
              />
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
            </div>

            <select
              className="rounded border px-3 py-2 text-sm bg-white"
              value={rStatus}
              onChange={(e) => setRStatus(e.target.value as any)}
              title="Status"
            >
              <option value="all">All</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="used">used</option>
              <option value="expired">expired</option>
              <option value="rejected">rejected</option>
              <option value="cancelled">cancelled</option>
            </select>

            <button
              onClick={fetchRedemptions}
              className="inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white border-b text-left">
              <tr className="bg-gray-50">
                <th className="p-3">ID</th>
                <th className="p-3">User</th>
                <th className="p-3">Reward</th>
                <th className="p-3">Point</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3">Voucher</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Used</th>
                <th className="p-3">QR</th>
              </tr>
            </thead>
            <tbody>
              {rLoading ? (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={10}>
                    Loading...
                  </td>
                </tr>
              ) : filteredRedemptions.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={10}>
                    No redemption history found
                  </td>
                </tr>
              ) : (
                filteredRedemptions.map((rr) => (
                  <tr key={rr.id} className="border-t align-top">
                    <td className="p-3 font-mono">{rr.id}</td>

                    <td className="p-3">
                      <div className="font-medium">
                        {rr.user_name || `User #${rr.user_id}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {rr.user_email || `user_id: ${rr.user_id}`}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="font-medium">
                        {rr.reward_title || `Reward #${rr.reward_id}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        reward_id: {rr.reward_id}
                      </div>
                    </td>

                    <td className="p-3">
                      {Number(rr.cost_points || 0).toLocaleString()}
                    </td>

                    <td className="p-3">
                      <RedemptionBadge status={rr.status} />
                    </td>

                    <td className="p-3">{fmtDT(rr.created_at)}</td>

                    <td className="p-3 font-mono">{rr.voucher_code || "-"}</td>

                    <td className="p-3">{fmtDT(rr.expires_at)}</td>

                    <td className="p-3">{fmtDT(rr.used_at)}</td>

                    <td className="p-3">
                      {rr.qr_image_url ? (
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded overflow-hidden border bg-gray-50">
                            <img
                              src={rr.qr_image_url}
                              alt="qr"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <a
                            className="text-xs text-blue-600 hover:underline"
                            href={rr.qr_image_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 text-xs text-gray-500 border-t bg-gray-50 flex items-center justify-between">
          <div>
            Showing <span className="font-medium">{filteredRedemptions.length}</span>{" "}
            records
          </div>
          <button
            onClick={() => {
              setRQ("");
              setRStatus("all");
            }}
            className="text-xs underline text-gray-600 hover:text-gray-800"
          >
            Reset filters
          </button>
        </div>
      </div>
    </div>
  );
}
