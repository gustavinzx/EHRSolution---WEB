const ALERT_STATES = new Set(['no_signal', 'security_alert']);
const FUELING_STATES = new Set(['fueling', 'awaiting_fueling_authorization']);
const OK_STATES = new Set(['ok', 'low_fuel', 'arrived']);

function classifyState(state) {
  if (!state) return null;
  if (ALERT_STATES.has(state)) return 'alert';
  if (FUELING_STATES.has(state)) return 'fueling';
  if (OK_STATES.has(state)) return 'ok';
  return null;
}

export function getTruckVisualState(truck) {
  if (!truck || typeof truck !== 'object') return 'ok';

  const simCategory = classifyState(truck.sim_state);
  if (simCategory === 'alert' || simCategory === 'fueling') {
    return simCategory;
  }

  if (FUELING_STATES.has(truck.route_phase)) {
    return 'fueling';
  }

  if (simCategory === 'ok') {
    return 'ok';
  }

  const statusCategory = classifyState(truck.status);
  if (statusCategory) {
    return statusCategory;
  }

  return 'ok';
}
