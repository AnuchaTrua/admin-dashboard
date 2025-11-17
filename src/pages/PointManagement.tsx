import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

/* ---------- Types ---------- */
export type Reward = {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  cost_points: number;
  expires_at: string | null; // MySQL DATETIME string 'YYYY-MM-DD HH:MM:SS' or null
  active: 0 | 1;
  stock: number;
  created_at?: string;
  updated_at?: string;
};

type ApiList<T> = { success?: boolean; data?: T } | T;

/* ---------- Helpers ---------- */
const toMySQLDateTime = (val: string | null): string | null => {
  // takes input from <input type="datetime-local"> (YYYY-MM-DDTHH:mm) -> 'YYYY-MM-DD HH:mm:00'
  if (!val) return null;
  const [d, t] = val.split("T");
  if (!d || !t) return null;
  return `${d} ${t}:00`;
};

const toLocalInputValue = (mysqlDT?: string | null): string => {
  // 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DDTHH:mm'
  if (!mysqlDT) return "";
  const [d, t] = mysqlDT.split(" ");
  if (!d || !t) return "";
  const [hh, mm] = t.split(":");
  return `${d}T${hh}:${mm}`;
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

/* ---------- Create / Edit Modal ---------- */
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
  const [imageUrl, setImageUrl] = useState("");
  const [costPoints, setCostPoints] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [active, setActive] = useState<0 | 1>(1);
  const [expiresAtInput, setExpiresAtInput] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title ?? "");
      setDescription(initial.description ?? "");
      setImageUrl(initial.image_url ?? "");
      setCostPoints(Number.isFinite(initial.cost_points) ? initial.cost_points : "");
      setStock(Number.isFinite(initial.stock) ? initial.stock : "");
      setActive(initial.active ?? 1);
      setExpiresAtInput(toLocalInputValue(initial.expires_at));
    } else {
      setTitle("");
      setDescription("");
      setImageUrl("");
      setCostPoints("");
      setStock("");
      setActive(1);
      setExpiresAtInput("");
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert("กรอกชื่อของรางวัลก่อนนะ");
    if (costPoints === "" || Number(costPoints) < 0) return alert("กรอกแต้มให้ถูกต้อง");
    if (stock === "" || Number(stock) < 0) return alert("กรอกสต็อกให้ถูกต้อง");

    await onSubmit({
      title: title.trim().slice(0, 120),
      description,
      image_url: imageUrl.trim() ? imageUrl.trim() : null,
      cost_points: Number(costPoints),
      stock: Number(stock),
      active,
      expires_at: toMySQLDateTime(expiresAtInput),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <h3 className="text-lg font-semibold">
            {initial ? "แก้ไขของรางวัล" : "สร้างของรางวัลใหม่"}
          </h3>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm hover:bg-gray-100">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-600">ชื่อ (สูงสุด 120)</label>
              <input
                className="w-full rounded border px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">แต้มที่ใช้แลก</label>
              <input
                type="number"
                min={0}
                className="w-full rounded border px-3 py-2"
                value={costPoints}
                onChange={(e) => setCostPoints(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">สต็อก</label>
              <input
                type="number"
                min={0}
                className="w-full rounded border px-3 py-2"
                value={stock}
                onChange={(e) => setStock(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">วันหมดอายุ</label>
              <input
                type="datetime-local"
                className="w-full rounded border px-3 py-2"
                value={expiresAtInput}
                onChange={(e) => setExpiresAtInput(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">รูปภาพ (URL)</label>
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="https://…"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                maxLength={255}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">สถานะ</label>
              <select
                className="w-full rounded border px-3 py-2"
                value={active}
                onChange={(e) => setActive(Number(e.target.value) ? 1 : 0)}
              >
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">รายละเอียด</label>
            <textarea
              className="h-28 w-full resize-y rounded border px-3 py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2">
              ยกเลิก
            </button>
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
              บันทึก
            </button>
          </div>
        </form>
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
            ยกเลิก
          </button>
          <button className="rounded bg-red-600 px-4 py-2 text-white" onClick={onConfirm}>
            ยืนยัน
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
      const data = (res.data as ApiList<Reward[]>);
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
          <p className="text-sm text-gray-500">จัดการของรางวัลสำหรับระบบสะสมแต้ม</p>
        </div>
        <div className="flex w-full items-center gap-3 md:w-auto">
          <input
            className="w-full rounded border px-3 py-2 md:w-64"
            placeholder="ค้นหาของรางวัล…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            + New Reward
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
                  <td className="p-3">{r.expires_at ?? "-"}</td>
                  <td className="p-3">
                    <StatusBadge active={r.active} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => toggleActive(r)}
                        title="Toggle Active"
                      >
                        {r.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => {
                          setEditing(r);
                          setOpenForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                        onClick={() => setOpenDelete(r)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!loading && filtered.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    ไม่พบของรางวัล
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
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
        title="ลบของรางวัล"
        message={`ต้องการลบ "${openDelete?.title ?? ""}" จริงหรือไม่?`}
        onCancel={() => setOpenDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
