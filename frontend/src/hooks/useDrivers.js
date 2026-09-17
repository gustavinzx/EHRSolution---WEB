import { useState, useCallback, useEffect } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDrivers = useCallback(async (active = null) => {
    setLoading(true);
    try {
      const url = active !== null ? `/drivers?active=${active}` : '/drivers';
      const response = await client.get(url);
      setDrivers(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao carregar motoristas';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const createDriver = async (driverData) => {
    try {
      const response = await client.post('/drivers', driverData);
      setDrivers(prev => [...prev, response.data]);
      toast.success('Motorista criado com sucesso');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar motorista');
      return false;
    }
  };

  const updateDriver = async (id, driverData) => {
    try {
      const response = await client.put(`/drivers/${id}`, driverData);
      setDrivers(prev => prev.map(d => d.id === id ? response.data : d));
      toast.success('Motorista atualizado com sucesso');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar motorista');
      return false;
    }
  };

  const deactivateDriver = async (id) => {
    try {
      await client.patch(`/drivers/${id}/deactivate`);
      setDrivers(prev => prev.map(d => d.id === id ? { ...d, is_active: false } : d));
      toast.success('Motorista desativado');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao desativar motorista');
      return false;
    }
  };

  const activateDriver = async (id) => {
    try {
      const response = await client.patch(`/drivers/${id}/activate`);
      setDrivers(prev => prev.map(d => d.id === id ? response.data : d));
      toast.success('Motorista reativado');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao reativar motorista');
      return false;
    }
  };

  const assignTruck = async (driverId, truckId) => {
    try {
      await client.post(`/drivers/${driverId}/trucks`, { truck_id: truckId });
      fetchDrivers();
      toast.success('Caminhão vinculado com sucesso');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao vincular caminhão');
      return false;
    }
  };

  const fetchRanking = useCallback(async () => {
    try {
      const response = await client.get('/drivers/ranking');
      return response.data;
    } catch (err) {
      toast.error('Erro ao buscar ranking');
      return [];
    }
  }, []);

  const fetchDriverScore = useCallback(async (id) => {
    try {
      const response = await client.get(`/drivers/${id}/score`);
      return response.data;
    } catch (err) {
      toast.error('Erro ao buscar score do motorista');
      return null;
    }
  }, []);

  return { 
    drivers, 
    loading, 
    error, 
    fetchDrivers, 
    createDriver, 
    updateDriver, 
    deactivateDriver, activateDriver,
    assignTruck,
    fetchRanking,
    fetchDriverScore
  };
}
