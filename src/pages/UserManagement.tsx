import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

type User = {
  user_id: number;
  fname: string;
  lname: string;
  email: string;
  phone: string;            // CHAR(10)
  role: string;             // VARCHAR(5)  -> 'user' | 'admin'
  status: 0 | 1;            // BIT(1)      -> 0=blocked,1=active
  created_at?: string;      // TIMESTAMP
  updated_at?: string;      // TIMESTAMP
  bic_goal?: number;        // FLOAT
  walk_goal?: number;       // FLOAT
  house_member?: number;    // TINYINT
  profile_pic_url?: string; // VARCHAR(255)
  vehicle?: string;         // VARCHAR(50)
};

/* -------------------- Edit Modal -------------------- */
function EditUserModal({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<User>>({});

  useEffect(() => {
    if (user) {
      setForm({
        fname: user.fname,
        lname: user.lname,
        phone: user.phone,
        role: user.role,
        vehicle: user.vehicle ?? '',
        profile_pic_url: user.profile_pic_url ?? '',
        bic_goal: user.bic_goal ?? undefined,
        walk_goal: user.walk_goal ?? undefined,
        house_member: user.house_member ?? undefined,
        status: Number(user.status) as 0 | 1,
      });
    }
  }, [user]);

  if (!open || !user) return null;

  const onChange = (k: keyof User, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // อัปเดตเฉพาะฟิลด์ที่เปลี่ยน (PUT ฝั่ง backend รองรับ)
    await api.put(`/admin/users/${user.user_id}`, {
      ...form,
      status: Number(form.status), // กันเผื่อ string
    });
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">แก้ไขผู้ใช้ (ID: {user.user_id})</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600">Email (อ่านอย่างเดียว)</label>
              <input
                value={user.email}
                disabled
                className="w-full border px-3 py-2 rounded bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">สถานะ</label>
              <select
                value={Number(form.status ?? 1)}
                onChange={(e) => onChange('status', Number(e.target.value) as 0 | 1)}
                className="w-full border px-3 py-2 rounded"
              >
                <option value={1}>Active</option>
                <option value={0}>Blocked</option>
              </select>
            </div>
          </div>

          {/* ชื่อ-นามสกุล */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">ชื่อ (fname)</label>
              <input
                value={form.fname ?? ''}
                onChange={(e) => onChange('fname', e.target.value)}
                className="w-full border px-3 py-2 rounded"
                maxLength={50}
                required
              />
            </div>
            <div>
              <label className="block text-sm">นามสกุล (lname)</label>
              <input
                value={form.lname ?? ''}
                onChange={(e) => onChange('lname', e.target.value)}
                className="w-full border px-3 py-2 rounded"
                maxLength={50}
                required
              />
            </div>
          </div>

          {/* โทร / ยานพาหนะ */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">เบอร์โทร (10 หลัก)</label>
              <input
                value={form.phone ?? ''}
                onChange={(e) => onChange('phone', e.target.value)}
                className="w-full border px-3 py-2 rounded"
                maxLength={10}
                pattern="\d{10}"
                title="กรอกตัวเลข 10 หลัก"
                required
              />
            </div>
            <div>
              <label className="block text-sm">Vehicle</label>
              <input
                value={form.vehicle ?? ''}
                onChange={(e) => onChange('vehicle', e.target.value)}
                className="w-full border px-3 py-2 rounded"
                maxLength={50}
              />
            </div>
          </div>

          {/* Role / Profile Pic */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">Role</label>
              <select
                value={form.role ?? 'user'}
                onChange={(e) => onChange('role', e.target.value)}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm">Profile Picture URL</label>
              <input
                value={form.profile_pic_url ?? ''}
                onChange={(e) => onChange('profile_pic_url', e.target.value)}
                className="w-full border px-3 py-2 rounded"
                maxLength={255}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Goals / House member */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm">Walk Goal (FLOAT)</label>
              <input
                type="number"
                step="any"
                value={form.walk_goal ?? ''}
                onChange={(e) =>
                  onChange('walk_goal', e.target.value === '' ? undefined : Number(e.target.value))
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm">Bicycle Goal (FLOAT)</label>
              <input
                type="number"
                step="any"
                value={form.bic_goal ?? ''}
                onChange={(e) =>
                  onChange('bic_goal', e.target.value === '' ? undefined : Number(e.target.value))
                }
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div>
              <label className="block text-sm">House Member (TINYINT)</label>
              <input
                type="number"
                value={form.house_member ?? ''}
                onChange={(e) =>
                  onChange('house_member', e.target.value === '' ? undefined : Number(e.target.value))
                }
                className="w-full border px-3 py-2 rounded"
                min={0}
                max={127}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border">
              ยกเลิก
            </button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------- Main Page -------------------- */
export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      // รองรับทั้ง array ตรง ๆ หรือ { data: [...] }
      const payload = Array.isArray(res.data) ? res.data : res.data?.data;
      setUsers(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Fetch users error:', err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleBlockToggle = async (u: User) => {
    try {
      if (Number(u.status) === 1) {
        await api.patch(`/admin/users/${u.user_id}/block`);   // -> status = 0
      } else {
        await api.patch(`/admin/users/${u.user_id}/unblock`); // -> status = 1
      }
      await fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบ user นี้?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      await fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const columns = useMemo(
    () => ['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Vehicle', 'Profile', 'Actions'],
    []
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">User Management</h2>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white rounded shadow overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                {columns.map((c) => (
                  <th key={c} className="p-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-t">
                  <td className="p-2">{u.user_id}</td>
                  <td className="p-2">
                    {u.fname} {u.lname}
                  </td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.phone}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">
                    <span className={Number(u.status) === 1 ? 'text-green-600' : 'text-red-600'}>
                      {Number(u.status) === 1 ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td className="p-2">{u.vehicle || '-'}</td>
                  <td className="p-2">
                    {u.profile_pic_url ? (
                      <img
                        src={u.profile_pic_url}
                        alt="Profile"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      'No pic'
                    )}
                  </td>
                  <td className="p-2 space-x-2">
                    <button
                      onClick={() => setEditing(u)}
                      className="px-2 py-1 bg-blue-100 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleBlockToggle(u)}
                      className="px-2 py-1 bg-yellow-100 rounded"
                    >
                      {Number(u.status) === 1 ? 'Block' : 'Unblock'}
                    </button>
                    <button
                      onClick={() => handleDelete(u.user_id)}
                      className="px-2 py-1 bg-red-100 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <EditUserModal
        open={!!editing}
        onClose={() => setEditing(null)}
        user={editing}
        onSaved={fetchUsers}
      />
    </div>
  );
}
