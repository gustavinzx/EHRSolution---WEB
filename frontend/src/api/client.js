import axios from 'axios';
import toast from 'react-hot-toast';

let sessionExpiredNotified = false;

const client = axios.create({
  baseURL: '/api',
});

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      const isLoginRequest = url.includes('/auth/login') || url.includes('/auth/driver/login');
      const isOnLoginPage = window.location.pathname === '/login';

      // 401 de credenciais erradas (ou já na tela de login): não apaga a sessão nem recarrega a página,
      // o erro segue para o chamador exibir a mensagem sem perder o que o usuário digitou.
      if (!isLoginRequest && !isOnLoginPage) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Toast único mesmo que várias requisições falhem juntas
        if (!sessionExpiredNotified) {
          sessionExpiredNotified = true;
          toast.error('Sessão expirada. Entre novamente.', { id: 'session-expired' });
        }
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default client;
