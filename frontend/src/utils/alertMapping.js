import { AlertTriangle, Clock, Activity, ShieldAlert, Droplet, UserX, Bluetooth } from 'lucide-react';

export function getAlertMeta(type) {
  switch (type) {
    case 'fuel_divergence':
      return { label: 'Divergência bomba x tanque', icon: AlertTriangle };
    case 'fueling_off_hours':
      return { label: 'Abastecimento fora do horário', icon: Clock };
    case 'consumption_anomaly':
      return { label: 'Consumo fora do padrão', icon: Activity };
    case 'unverified_fueling':
      return { label: 'Abastecimento sem medição', icon: Droplet };
    case 'suspicious_fuel_drop':
      return { label: 'Queda Suspeita de Combustível', icon: Droplet };
    case 'unauthorized_station':
      return { label: 'Posto Não Autorizado', icon: ShieldAlert };
    case 'facial_auth_failed':
      return { label: 'Falha na Biometria Facial', icon: UserX };
    case 'facial_auth_locked':
      return { label: 'Biometria Facial Bloqueada', icon: UserX };
    case 'ble_fallback_used':
      return { label: 'BLE Fallback Utilizado', icon: Bluetooth };
    case 'unauthorized_fueling_attempt':
      return { label: 'Tentativa Bloqueada (Geofence)', icon: ShieldAlert };
    default:
      return { label: type, icon: AlertTriangle };
  }
}
