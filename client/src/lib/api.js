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
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry && !String(original?.url || '').includes('/auth/login')) {
      original._retry = true;
      refreshPromise = refreshPromise || api.post('/auth/refresh-token').finally(() => { refreshPromise = null; });
      try {
        const { data } = await refreshPromise;
        if (data.accessToken) setToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        clearToken();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
