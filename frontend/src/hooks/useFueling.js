import { useState, useCallback, useEffect, useRef } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export function useFueling(initialFilters = {}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const filtersRef = useRef(initialFilters);

  const fetchLogs = useCallback(async (filters) => {
    const activeFilters = filters ?? filtersRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilters.truckId) params.append('truck_id', activeFilters.truckId);
      if (activeFilters.driverId) params.append('driver_id', activeFilters.driverId);
      if (activeFilters.start) params.append('start', activeFilters.start);
      if (activeFilters.end) params.append('end', activeFilters.end);

      const response = await client.get('/fueling', { params });
      setLogs(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao carregar log de abastecimento';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestSession = useCallback((truckId, driverId, stationId, releaseMethod) =>
    client.post('/fueling/sessions', { truck_id: truckId, driver_id: driverId, station_id: stationId, release_method: releaseMethod }).then(r => r.data), []);
  
  const authorizeSession = useCallback((sessionId) =>
    client.post(`/fueling/sessions/${sessionId}/authorize`).then(r => r.data), []);
  
  const finishSession = useCallback((sessionId) =>
    client.post(`/fueling/sessions/${sessionId}/finish`).then(r => r.data), []);
    
  const getActiveSession = useCallback((truckId) =>
    client.get(`/fueling/sessions/${truckId}/active`).then(r => r.data), []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs, requestSession, authorizeSession, finishSession, getActiveSession };
}
