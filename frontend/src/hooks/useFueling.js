import { useState, useCallback, useEffect, useRef } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export function useFueling(initialFilters = {}) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Use ref to avoid stale closure without recreating fetchLogs on every render
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
  }, []); // stable — no deps that change on every render

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}
