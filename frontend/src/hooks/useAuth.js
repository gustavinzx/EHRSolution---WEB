import { useState, useCallback } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = useCallback(async (email, password) => {
    try {
      const response = await client.post('/auth/login', { email, password });
      const { token: newToken, user: newUser } = response.data;
      
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      setToken(newToken);
      setUser(newUser);
      return true;
    } catch (error) {
      const message = error.response?.data?.error || 'Erro ao realizar login';
      toast.error(message);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    // Force redirect to login and flush all React states/sockets cleanly
    window.location.href = '/login';
  }, []);

  return {
    user,
    token,
    isAuthenticated: !!token,
    login,
    logout,
  };
}
