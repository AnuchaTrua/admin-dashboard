import React, { useEffect, useState } from 'react';
import api from '../services/api';

type User = {
  user_id: number;
  fname: string;
  lname: string;
  email: string;
  phone: string;
  role: string;
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get('/admin/users');
        setUsers(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">User Management</h2>
      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full">
          <thead>
            <tr className="text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Role</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id} className="border-t">
                <td className="p-2">{u.user_id}</td>
                <td className="p-2">{u.fname} {u.lname}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.phone}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">
                  <button className="px-2 py-1 bg-blue-50 rounded">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
