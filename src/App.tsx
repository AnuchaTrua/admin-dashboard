
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import BlogManagement from './pages/BlogManagement';
import PointManagement from './pages/PointManagement';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      {/* หน้า login */}
      <Route path="/login" element={<Login />} />

      {/* กลุ่ม admin */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route index element={<Dashboard />} />
        {/* User Management */}
        <Route path="users" element={<UserManagement />} />
        {/* Blog Management */}
        <Route path="blogs" element={<BlogManagement />} />
        {/* Point Management */}
        <Route path="points" element={<PointManagement />} />
      </Route>

      {/* redirect ไป login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      {/* not found */}
      <Route path="*" element={<div className="p-6">Not Found</div>} />
    </Routes>
  );
}

export default App;
