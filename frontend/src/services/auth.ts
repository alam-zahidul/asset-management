import api from './api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
};
