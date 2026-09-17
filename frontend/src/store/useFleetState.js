import { create } from 'zustand';
import { io } from 'socket.io-client';
import client from '../api/client';

let socket = null;

const useFleetState = create((set, get) => ({
  fleet: [],
  truckRoutes: {},
  truckPhases: {},
  liveEvents: { fueling_now: [], recent_logs: [] },
  alerts: [],
  loading: true,
  error: null,
  selectedTruckId: null,

  connectSocket: () => {
    if (socket) return;
    const token = localStorage.getItem('token');
    const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    socket = io(url, { auth: { token } });

    socket.on('fleetUpdate', (data) => {
      const fleetData = Array.isArray(data) ? data : [];
      const currentRoutes = get().truckRoutes;
      const previousPhases = get().truckPhases || {};
      const newPhases = {};
      fleetData.forEach(truck => {
        newPhases[truck.id] = truck.route_phase;
        const phaseChanged = previousPhases[truck.id] && previousPhases[truck.id] !== truck.route_phase;
        if ((!currentRoutes[truck.id] && truck.route_index !== undefined) || phaseChanged) {
          get().fetchTruckRoute(truck.id);
        }
      });
      set({ fleet: fleetData, loading: false, truckPhases: newPhases });
    });

    socket.on('liveEventsUpdate', (data) => {
      set({ liveEvents: data });
    });

    socket.on('newAlert', (alert) => {
      set((state) => ({ alerts: [alert, ...state.alerts] }));
    });
  },

  disconnectSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },
    truckRoutes: {}, 
    truckPhases: {},
    liveEvents: { fueling_now: [], recent_logs: [] },
    alerts: [],
    loading: true,
    error: null,
    selectedTruckId: null,

    setSelectedTruckId: (id) => set({ selectedTruckId: id }),

    fetchFleet: async () => {
      try {
        const response = await client.get('/fleet');
        const data = response.data;
        const fleetData = Array.isArray(data) ? data : [];
        
        const currentRoutes = get().truckRoutes;
        const newPhases = {};
        
        fleetData.forEach(truck => {
          newPhases[truck.id] = truck.route_phase;
          if (!currentRoutes[truck.id] && truck.route_index !== undefined) {
            get().fetchTruckRoute(truck.id);
          }
        });
        
        set({ fleet: fleetData, loading: false, error: null, truckPhases: newPhases });
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

    resolveAlert: async (id, note) => {
      try {
        await client.patch(`/fleet/alerts/${id}/resolve`, { resolution_note: note, resolved_by: 'Gestor' });
        set(state => ({
          alerts: state.alerts.filter(a => a.id !== id)
        }));
      } catch (error) {
        console.error('Erro ao resolver alerta:', error);
      }
    }
}));

export default useFleetState;
