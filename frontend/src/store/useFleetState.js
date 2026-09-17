import { create } from 'zustand';
import { io } from 'socket.io-client';
import client from '../api/client';

const socket = io('http://localhost:3001');

const useFleetState = create((set, get) => {
  // Listen for socket events once
  socket.on('fleetUpdate', (data) => {
    const fleetData = Array.isArray(data) ? data : [];
    set({ fleet: fleetData, loading: false });
    
    // Fetch detailed route for new trucks
    const currentRoutes = get().truckRoutes;
    fleetData.forEach(truck => {
      if (!currentRoutes[truck.id] && truck.route_index !== undefined) {
        get().fetchTruckRoute(truck.id);
      }
    });
  });

  socket.on('liveEventsUpdate', (data) => {
    set({ liveEvents: data });
  });

  socket.on('newAlert', (alert) => {
    set((state) => ({ alerts: [alert, ...state.alerts] }));
  });

  return {
    fleet: [],
    truckRoutes: {}, 
    liveEvents: { fueling_now: [], recent_logs: [] },
    alerts: [],
    loading: true,
    error: null,
    selectedTruckId: null,

    setSelectedTruckId: (id) => set({ selectedTruckId: id }),

    fetchFleet: async () => {
      // Still useful for initial load before first tick
      try {
        const response = await client.get('/fleet');
        const data = response.data;
        const fleetData = Array.isArray(data) ? data : [];
        set({ fleet: fleetData, loading: false, error: null });

        const currentRoutes = get().truckRoutes;
        fleetData.forEach(truck => {
          if (!currentRoutes[truck.id] && truck.route_index !== undefined) {
            get().fetchTruckRoute(truck.id);
          }
        });
      } catch (error) {
        console.error(error);
        set({ error: error.message, loading: false });
      }
    },
    fetchTruckRoute: async (id) => {
      try {
        const response = await client.get(`/fleet/${id}/route`);
        const data = response.data;
        if (data.route_geometry) {
          set(state => ({
            truckRoutes: {
              ...state.truckRoutes,
              [id]: data.route_geometry
            }
          }));
        }
      } catch (error) {
        console.error(`Erro ao buscar rota do caminhão ${id}:`, error);
      }
    },

    fetchLiveEvents: async () => {
      try {
        const response = await client.get('/fleet/live-events');
        set({ liveEvents: response.data });
      } catch (error) {
        console.error('Erro ao buscar eventos ao vivo:', error);
      }
    },

    fetchAlerts: async () => {
      try {
        const response = await client.get('/alerts');
        set({ alerts: Array.isArray(response.data) ? response.data : [] });
      } catch (error) {
        console.error('Erro ao buscar alertas:', error);
      }
    }
  };
});

export default useFleetState;
