import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000,
  timeoutErrorMessage: 'Tiempo de espera agotado. Verifique su conexión.'
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const retryFailedRequests = async (error, maxRetries = 2) => {
  const config = error.config;
  if (!config || !maxRetries) return Promise.reject(error);
  
  config.__retryCount = config.__retryCount || 0;
  
  if (config.__retryCount >= maxRetries) {
    return Promise.reject(error);
  }
  
  if (error.response?.status >= 500 || error.code === 'ECONNABORTED') {
    config.__retryCount += 1;
    const backoff = Math.pow(2, config.__retryCount) * 500;
    await new Promise(resolve => setTimeout(resolve, backoff));
    return api(config);
  }
  
  return Promise.reject(error);
};

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        sessionStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return retryFailedRequests(error);
  }
);

export default api;
