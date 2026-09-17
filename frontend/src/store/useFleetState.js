import { create } from 'zustand';
import { io } from 'socket.io-client';
import client from '../api/client';
import { normalizeRoute } from '../utils/routeGeometry';
const routeRequests = new Map();

let socket = null;

const useFleetState = create((set, get) => ({
  fleet: [],
  routeErrors: {},
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
          get().fetchTruckRoute(truck.id, { force: Boolean(phaseChanged) });
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
          const phaseChanged = get().truckPhases[truck.id] && get().truckPhases[truck.id] !== truck.route_phase;
          if ((!currentRoutes[truck.id] && truck.route_index !== undefined) || phaseChanged) {
            get().fetchTruckRoute(truck.id, { force: Boolean(phaseChanged) });
          }
        });
        
        set({ fleet: fleetData, loading: false, error: null, truckPhases: newPhases });
      } catch (error) {
        console.error(error);
        set({ error: error.message, loading: false });
      }
    },

    fetchTruckRoute: (id, { force = false } = {}) => {
      id = String(id);
      const previous = routeRequests.get(id);
      if (previous && !force) return previous.promise;
      if (previous) previous.cancel();
      const controller = new AbortController();
      const entry = { controller };
      routeRequests.set(id, entry);
      set(state => ({ routeErrors: { ...state.routeErrors, [id]: null } }));
      let timer;
      const deadline = new Promise((_, reject) => {
        entry.cancel = () => { controller.abort(); reject(new Error('Busca substituída')); };
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Tempo limite de 15 segundos ao carregar a rota'));
        }, 15000);
      });
      const work = async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (controller.signal.aborted) throw new Error('Busca cancelada');
            const response = await client.get(`/fleet/${id}/route`, { timeout: 10000, signal: controller.signal });
            const route = normalizeRoute(response.data.route_geometry);
            if (!route) throw new Error('Rota indisponível ou inválida');
            return route;
          } catch (error) {
            const status = error.response?.status;
            if (controller.signal.aborted || attempt === 2 || (status >= 400 && status < 500 && status !== 429)) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      };
      entry.promise = Promise.race([work(), deadline]).then(route => {
        if (routeRequests.get(id) !== entry) return null;
        set(state => ({ truckRoutes: { ...state.truckRoutes, [id]: route }, routeErrors: { ...state.routeErrors, [id]: null } }));
        return route;
      }).catch(error => {
        if (routeRequests.get(id) === entry) {
          set(state => ({ routeErrors: { ...state.routeErrors, [id]: error.message } }));
        }
        return null;
      }).finally(() => {
        clearTimeout(timer);
        if (routeRequests.get(id) === entry) routeRequests.delete(id);
      });
      return entry.promise;
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
