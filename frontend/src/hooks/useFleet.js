import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';
import useFleetState from '../store/useFleetState';

export function useFleet() {
  const { fleet, loading, error, fetchFleet } = useFleetState();

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
        route: routeRes.data,
        unloading_events: unloadingRes.data
      };
    } catch (err) {
      toast.error('Erro ao carregar detalhes do caminhão');
      return null;
    }
  }, []);

  return { trucks: fleet, loading, error, refetch: fetchFleet, fetchTruckDetails };
}

export function useLiveEvents() {
  const { liveEvents, fetchLiveEvents } = useFleetState();

  useEffect(() => {
    fetchLiveEvents();
  }, [fetchLiveEvents]);

  return { ...liveEvents, loading: false };
}

