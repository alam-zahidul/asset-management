import axios from 'axios';
import DOMPurify from 'dompurify';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Sanitize string values in request data
function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') return DOMPurify.sanitize(data, { ALLOWED_TAGS: [] });
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (data !== null && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      sanitized[key] = sanitizeData(value);
    }
    return sanitized;
  }
  return data;
}

// Request interceptor: attach token + sanitize body
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
    config.data = sanitizeData(config.data);
  }

  return config;
});

// Response interceptor: handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
