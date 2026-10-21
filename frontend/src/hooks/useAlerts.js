import { useState, useEffect, useCallback, useRef } from 'react';
import client from '../api/client';

import useFleetState from '../store/useFleetState';

const EMPTY_FILTERS = {};

export function useAlerts(filters = EMPTY_FILTERS) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const filtersKey = JSON.stringify(filters);

  const fetchAlerts = useCallback(async (overrideFilters) => {
    try {
      setLoading(true);
      const currentFilters = overrideFilters ?? filtersRef.current;
      const params = new URLSearchParams();
      if (currentFilters.truck_id) params.append('truck_id', currentFilters.truck_id);
      if (currentFilters.type) params.append('type', currentFilters.type);
      if (currentFilters.severity) params.append('severity', currentFilters.severity);
      if (currentFilters.status) params.append('status', currentFilters.status);
      if (currentFilters.start) params.append('start', currentFilters.start);
      if (currentFilters.end) params.append('end', currentFilters.end);
      
      const { data } = await client.get(`/alerts?${params.toString()}`);
      setAlerts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts, filtersKey]);

  const resolveAlert = async (id, resolution_note) => {
    try {
      await client.patch(`/alerts/${id}/resolve`, { resolution_note });
      useFleetState.setState(s => ({ alerts: s.alerts.filter(a => a.id !== id) }));
      await fetchAlerts();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return { alerts, loading, error, refetch: fetchAlerts, resolveAlert };
}
