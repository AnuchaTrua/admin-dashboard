
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, FileText, Gift, LogOut } from 'lucide-react';

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const baseClass = 'flex items-center gap-3 px-4 py-2 rounded transition-colors';
  const activeClass = `${baseClass} bg-gray-200 text-gray-900`;
  const inactiveClass = `${baseClass} text-gray-600 hover:bg-gray-50 hover:text-gray-900`;

  return (
    <aside className="w-64 bg-white border-r sticky top-0 h-screen overflow-y-auto">
      <div className="p-4 border-b">
        <div className="text-lg font-bold">Carbon Admin</div>
        <div className="text-sm text-gray-600">{user?.email}</div>
      </div>

      <nav className="p-4 space-y-2">
        <NavLink to="/admin" end className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <Users size={20} />
          <span>User Management</span>
        </NavLink>
        <NavLink to="/admin/blogs" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <FileText size={20} />
          <span>Blog Management</span>
        </NavLink>
        <NavLink to="/admin/points" className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <Gift size={20} />
          <span>Reward Management</span>
        </NavLink>

        <button className={`mt-4 w-full text-left ${inactiveClass} text-red-600 hover:bg-red-50 hover:text-red-700`} onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
