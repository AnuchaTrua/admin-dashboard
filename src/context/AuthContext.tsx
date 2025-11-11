import{ createContext, useState, useContext,  useEffect } from 'react';
import type { ReactNode } from 'react';
import api, { setAuthToken } from '../services/api';

type User = {
  user_id: number;
  fname: string;
  lname: string;
  email: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const resp = await api.post('/check-user', { email, password });
      const { token: tkn, data } = resp.data;
      if (!tkn || !data) return { success: false, message: 'Invalid response from server' };

      // ตรวจสอบว่าเป็น admin หรือไม่
      if (data.role !== 'admin') {
        return { success: false, message: 'บัญชีนี้ไม่ใช่ผู้ดูแลระบบ (admin)' };
      }

      setToken(tkn);
      setUser(data);
      localStorage.setItem('token', tkn);
      localStorage.setItem('user', JSON.stringify(data));
      setAuthToken(tkn);
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Login failed';
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthToken(null);
  };

  return <AuthContext.Provider value={{ user, token, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
