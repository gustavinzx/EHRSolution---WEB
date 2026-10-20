import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';
import useFleetState from '../store/useFleetState';

export function useFleet() {
  const { fleet, loading, error, isConnected, fetchFleet, createTruck } = useFleetState();

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  const fetchTruckDetails = useCallback(async (id) => {
    try {
      const [truckRes, routeRes, unloadingRes] = await Promise.all([
        client.get(`/fleet/${id}`),
        client.get(`/fleet/${id}/route`),
        client.get(`/fleet/${id}/unloading-events`).catch(() => ({ data: [] }))
      ]);
      return { 
        ...truckRes.data,
        telemetry: routeRes.data,
        unloading_events: unloadingRes.data
      };
    } catch (err) {
      if (err?.response?.status !== 404) {
        toast.error('Erro ao carregar detalhes do caminhão');
      }
      throw err;
    }
  }, []);

  const getHardwareKeyStatus = useCallback(async (id) => {
    const res = await client.get(`/fleet/${id}/hardware-key`);
    return res.data;
  }, []);

  const generateHardwareKey = useCallback(async (id) => {
    const res = await client.post(`/fleet/${id}/hardware-key`);
    return {
      api_key: res.data.api_key,
      prefix: res.data.prefix,
      created_at: res.data.created_at,
    };
  }, []);

  const revokeHardwareKey = useCallback(async (id) => {
    const res = await client.delete(`/fleet/${id}/hardware-key`);
    return res.data;
  }, []);

  return {
    trucks: fleet,
    loading,
    error,
    isConnected: Boolean(isConnected),
    refetch: fetchFleet,
    fetchTruckDetails,
    createTruck,
    getHardwareKeyStatus,
    generateHardwareKey,
    revokeHardwareKey,
  };
}

export function useLiveEvents() {
  const { liveEvents, fetchLiveEvents } = useFleetState();

  useEffect(() => {
    fetchLiveEvents();
  }, [fetchLiveEvents]);

  return { ...liveEvents, loading: false };
}

