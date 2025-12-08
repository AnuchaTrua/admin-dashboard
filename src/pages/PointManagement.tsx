import { useEffect, useMemo, useRef, useState } from "react";
import { Edit2, Trash2, Plus, X, Search, Power, PowerOff, Upload, Image as ImageIcon } from 'lucide-react';
import api from "../services/api";

/* ---------- Types ---------- */
export type Reward = {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  cost_points: number;
  start_at: string | null;   // ✅ NEW: start date-time
  expires_at: string | null; // 'YYYY-MM-DD HH:MM:SS' or null
  active: 0 | 1;
  stock: number;
  created_at?: string;
  updated_at?: string;
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

const StatusBadge = ({ active }: { active: 0 | 1 }) => (
  <span
    className={`px-2 py-0.5 rounded text-xs ${active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
      }`}
  >
    {active ? "Active" : "Inactive"}
  </span>
);

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
  const [costPoints, setCostPoints] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [active, setActive] = useState<0 | 1>(1);
  const [startAtInput, setStartAtInput] = useState("");   // ✅ NEW state
  const [expiresAtInput, setExpiresAtInput] = useState("");

  // image state
  const [imageUrl, setImageUrl] = useState<string>(""); // for existing image
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");   // local preview
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title ?? "");
      setDescription(initial.description ?? "");
      setCostPoints(Number.isFinite(initial.cost_points) ? initial.cost_points : "");
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
      setCostPoints("");
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
    if (costPoints === "" || Number(costPoints) < 0)
      return alert("Please enter a valid point cost.");
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
      cost_points: Number(costPoints),
      stock: Number(stock),
      active,
      start_at: toMySQLDateTime(startAtInput),     // ✅ send start_at
      expires_at: toMySQLDateTime(expiresAtInput), // ✅ send expires_at
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
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Point cost</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={costPoints}
                onChange={(e) =>
                  setCostPoints(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Stock</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={stock}
                onChange={(e) =>
                  setStock(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                value={active}
                onChange={(e) => setActive(Number(e.target.value) ? 1 : 0)}
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Start date &amp; time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={startAtInput}
                  onChange={(e) => setStartAtInput(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Expire date &amp; time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={expiresAtInput}
                  onChange={(e) => setExpiresAtInput(e.target.value)}
                />
              </div>
            </div>

            {/* Image: picker + preview + upload to S3 */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Reward Image
              </label>
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex-1 w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-500 transition-colors group relative overflow-hidden">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 z-10">
                      <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      <p className="text-sm text-gray-500 group-hover:text-gray-700">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-400">SVG, PNG, JPG or GIF</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {imageUrl && !fileObj && (
                    <p className="mt-2 text-xs text-gray-500">Using existing image. Upload new to replace.</p>
                  )}
                  {fileObj && <p className="mt-2 text-sm text-green-600 flex items-center gap-1"><ImageIcon size={14} /> Selected: {fileObj.name}</p>}
                </div>

                {(preview || imageUrl) && (
                  <div className="shrink-0">
                    <p className="text-xs text-gray-500 mb-2">Preview</p>
                    <div className="w-32 h-32 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 relative shadow-sm flex items-center justify-center">
                      {preview ? (
                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-gray-400">no image</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="h-28 w-full resize-y rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the reward..."
              />
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t bg-gray-50/50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            type="submit"
            className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initial ? 'Save Changes' : 'Create Reward'}
          </button>
        </div>
      </div>
    </div>
  );
}

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

/* ---------- Main Page ---------- */
export default function PointManagement() {
  const [list, setList] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [openDelete, setOpenDelete] = useState<Reward | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter(
      (r) =>
        r.title.toLowerCase().includes(keyword) ||
        (r.description || "").toLowerCase().includes(keyword)
    );
  }, [q, list]);

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

  useEffect(() => {
    fetchRewards();
  }, []);

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
    <div className="p-6">
      {/* Header */}
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
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

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Reward</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Start</th>   {/* ✅ new column */}
                <th className="p-3">Expires</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
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
                        className={`p-1.5 rounded border transition-colors ${r.active ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                        onClick={() => toggleActive(r)}
                        title={r.active ? "Deactivate" : "Activate"}
                      >
                        {r.active ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button
                        className="p-1.5 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                        onClick={() => {
                          setEditing(r);
                          setOpenForm(true);
                        }}
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        onClick={() => setOpenDelete(r)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    No rewards found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <RewardFormModal
        open={openForm}
        onClose={() => setOpenForm(false)}
        initial={editing}
        onSubmit={async (payload) => {
          if (editing) await handleUpdate(editing.id, payload);
          else await handleCreate(payload);
        }}
      />
      <ConfirmDialog
        open={!!openDelete}
        title="Delete reward"
        message={`Are you sure you want to delete "${openDelete?.title ?? ""
          }"?`}
        onCancel={() => setOpenDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
