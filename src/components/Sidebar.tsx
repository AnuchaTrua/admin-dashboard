
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeClass = 'block px-4 py-2 rounded bg-gray-200';

  return (
    <aside className="w-64 bg-white border-r">
      <div className="p-4 border-b">
        <div className="text-lg font-bold">Carbon Admin</div>
        <div className="text-sm text-gray-600">{user?.email}</div>
      </div>

      <nav className="p-4 space-y-2">
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? activeClass : 'block px-4 py-2 rounded hover:bg-gray-50')}>
          Dashboard
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? activeClass : 'block px-4 py-2 rounded hover:bg-gray-50')}>
          User Management
        </NavLink>
        <NavLink to="/admin/blogs" className={({ isActive }) => (isActive ? activeClass : 'block px-4 py-2 rounded hover:bg-gray-50')}>
          Blog Management
        </NavLink>
        <NavLink to="/admin/points" className={({ isActive }) => (isActive ? activeClass : 'block px-4 py-2 rounded hover:bg-gray-50')}>
          Point Management
        </NavLink>

        <button className="mt-4 px-4 py-2 w-full text-left rounded bg-red-50 hover:bg-red-100" onClick={handleLogout}>
          Logout
        </button>
      </nav>
    </aside>
  );
}
