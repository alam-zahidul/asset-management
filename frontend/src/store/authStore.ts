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
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);

      const { data: userData } = await api.get('/auth/me');
      set({ user: userData.data, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    if (!localStorage.getItem('accessToken')) {
      set({ isAuthenticated: false });
      return;
    }
    try {
      set({ isLoading: true });
      const { data } = await api.get('/auth/me');
      set({ user: data.data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  hasPermission: (permission: string) => {
    const { user } = get();
    if (!user) return false;
    if (user.roles.includes('admin')) return true;
    return user.permissions.includes(permission);
  },

  hasRole: (role: string) => {
    const { user } = get();
    return user?.roles.includes(role) ?? false;
  },
}));
