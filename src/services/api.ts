import axios from 'axios';

// ✅ ใช้ชื่อ ENV มาตรฐานเดียวกันกับไฟล์ .env.production / .env.development
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// ✅ สร้าง instance ของ axios
const api = axios.create({
  baseURL,
  timeout: 10000,
});

// ✅ แนบ token จาก localStorage ทุกครั้งโดยอัตโนมัติ
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ ดัก error กลาง เช่น token หมดอายุ → logout อัตโนมัติ
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn('🔒 Token expired or invalid — logging out...');
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ✅ helper สำหรับตั้ง token หลัง login
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('admin_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('admin_token');
  }
};

export default api;
