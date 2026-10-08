import { AlertTriangle, Clock, Activity, ShieldAlert, Droplet } from 'lucide-react';

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
    default:
      return { label: type, icon: AlertTriangle };
  }
}
