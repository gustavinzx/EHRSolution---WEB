const fs = require("fs");
let content = fs.readFileSync("src/store/useFleetState.js", "utf8");

const oldCode = `const socket = io('http://localhost:3001');

const useFleetState = create((set, get) => {
  socket.on('fleetUpdate', (data) => {
    const fleetData = Array.isArray(data) ? data : [];
    
    // Check for route phase changes to re-fetch geometry
    const currentRoutes = get().truckRoutes;
    const previousPhases = get().truckPhases || {};
    const newPhases = {};
    
    fleetData.forEach(truck => {
      newPhases[truck.id] = truck.route_phase;
      
      // Need to fetch route if we don't have it, OR if the phase changed (e.g. planned -> to_station)
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

  return {
    fleet: [],`;

const newCode = `let socket = null;

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
  },`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  content = content.replace("  };\n});", "}));");
  fs.writeFileSync("src/store/useFleetState.js", content);
  console.log("Bug 4 patched useFleetState.js");
} else {
  console.log("Failed to patch useFleetState.js");
}
