import { create } from 'zustand';
import api from '../services/api';

interface User {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('admin_accessToken'),
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('admin_accessToken', data.data.accessToken);
      localStorage.setItem('admin_refreshToken', data.data.refreshToken);

      const { data: userData } = await api.get('/auth/me');

      // Require admin role
      if (!userData.data.roles.includes('admin')) {
        localStorage.removeItem('admin_accessToken');
        localStorage.removeItem('admin_refreshToken');
        throw new Error('Admin access required');
      }

      set({ user: userData.data, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('admin_accessToken');
    localStorage.removeItem('admin_refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    if (!localStorage.getItem('admin_accessToken')) {
      set({ isAuthenticated: false });
      return;
    }
    try {
      set({ isLoading: true });
      const { data } = await api.get('/auth/me');
      if (!data.data.roles.includes('admin')) {
        throw new Error('Admin access required');
      }
      set({ user: data.data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('admin_accessToken');
      localStorage.removeItem('admin_refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
