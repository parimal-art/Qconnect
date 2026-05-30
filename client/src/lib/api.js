import axios from 'axios';
import { clearToken, getToken, setToken } from './authStorage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config || {};
    const url = String(original.url || '');
    const isLoginRequest = url.includes('/auth/login');
    const isRefreshRequest = url.includes('/auth/refresh-token');
    const isChangePasswordRequest = url.includes('/auth/change-password');

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isLoginRequest &&
      !isRefreshRequest &&
      !isChangePasswordRequest
    ) {
      original._retry = true;
      refreshPromise = refreshPromise || api.post('/auth/refresh-token').finally(() => {
        refreshPromise = null;
      });

      try {
        const { data } = await refreshPromise;
        if (data.accessToken) setToken(data.accessToken);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        clearToken();
        window.location.replace('/login');
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401 && isRefreshRequest) {
      clearToken();
      window.location.replace('/login');
    }

    return Promise.reject(error);
  }
);

export default api;
