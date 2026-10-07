import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export function useAlerts(filters = {}) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAlerts = useCallback(async (currentFilters = filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (currentFilters.truck_id) params.append('truck_id', currentFilters.truck_id);
      if (currentFilters.type) params.append('type', currentFilters.type);
      if (currentFilters.severity) params.append('severity', currentFilters.severity);
      if (currentFilters.status) params.append('status', currentFilters.status);
      if (currentFilters.start) params.append('start', currentFilters.start);
      if (currentFilters.end) params.append('end', currentFilters.end);
      
      const { data } = await client.get(`/alerts?${params.toString()}`);
      setAlerts(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const resolveAlert = async (id, resolution_note) => {
    try {
      await client.patch(`/alerts/${id}/resolve`, { resolution_note });
      await fetchAlerts();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return { alerts, loading, error, refetch: fetchAlerts, resolveAlert };
}
