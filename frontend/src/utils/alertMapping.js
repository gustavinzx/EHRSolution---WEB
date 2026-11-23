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
    case 'unrecognized_station':
      return { label: 'Posto não reconhecido (ANP)', icon: ShieldAlert };
    case 'facial_auth_failed':
      return { label: 'Falha na Biometria Facial', icon: UserX };
    case 'facial_auth_locked':
    case 'security_facial_auth_locked':
      return { label: 'Biometria Facial Bloqueada', icon: UserX };
    case 'ble_fallback_used':
      return { label: 'BLE Fallback Utilizado', icon: Bluetooth };
    case 'unauthorized_fueling_attempt':
    case 'security_unauthorized_fueling_attempt':
      return { label: 'Tentativa Bloqueada (Geofence)', icon: ShieldAlert };
    case 'lock_state_mismatch':
    case 'security_lock_state_mismatch':
      return { label: 'Divergência Física da Trava (Fim de Curso)', icon: ShieldAlert };
    case 'tamper':
    case 'security_tamper':
      return { label: 'Violação Física da Trava (Tamper)', icon: ShieldAlert };
    case 'gps_position_divergence':
    case 'security_gps_position_divergence':
      return { label: 'Divergência de Posição GPS', icon: ShieldAlert };
    case 'manager_override':
    case 'security_manager_override':
      return { label: 'Liberação Manual pelo Gestor', icon: ShieldAlert };
    default:
      return { label: type, icon: AlertTriangle };
  }
}
