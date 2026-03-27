import axios from 'axios';
import DOMPurify from 'dompurify';

const api = axios.create({
  baseURL: '/api/admin',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

function sanitize(data: unknown): unknown {
  if (typeof data === 'string') return DOMPurify.sanitize(data, { ALLOWED_TAGS: [] });
  if (Array.isArray(data)) return data.map(sanitize);
  if (data !== null && typeof data === 'object') {
    const s: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) s[k] = sanitize(v);
    return s;
  }
  return data;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
    config.data = sanitize(config.data);
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
