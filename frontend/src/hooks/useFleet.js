import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export function useFleet(pollInterval = 3000) {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFleet = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await client.get('/fleet');
      setTrucks(response.data);
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao carregar dados da frota';
      setError(msg);
      toast.error(msg);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet(true);
    
    if (pollInterval) {
      const intervalId = setInterval(() => {
        fetchFleet(false);
      }, pollInterval);
      
      return () => clearInterval(intervalId);
    }
  }, [fetchFleet, pollInterval]);

  const fetchTruckDetails = useCallback(async (id) => {
    try {
      const [truckRes, routeRes] = await Promise.all([
        client.get(`/fleet/${id}`),
        client.get(`/fleet/${id}/route`)
      ]);
      return { 
        ...truckRes.data,
        route: routeRes.data
      };
    } catch (err) {
      toast.error('Erro ao carregar detalhes do caminhão');
      return null;
    }
  }, []);

  return { trucks, loading, error, refetch: () => fetchFleet(true), fetchTruckDetails };
}

// ─── Hook de Eventos ao Vivo (polling a cada 6s) ──────────────────────────────
export function useLiveEvents() {
  const [events, setEvents] = useState({ fueling_now: [], recent_logs: [] });
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await client.get('/fleet/live-events');
      setEvents(res.data);
    } catch {
      // silently fail — não exibe toast para não irritar o gestor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, 6000);
    return () => clearInterval(id);
  }, [fetchEvents]);

  return { ...events, loading };
}

