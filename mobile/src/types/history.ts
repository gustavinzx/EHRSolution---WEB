export type HistoryReleaseMethod = 'facial' | 'ble_fallback' | 'manager_override' | string;
export type HistoryStatus = 'completed' | 'cancelled' | 'expired';
export type HistoryKind = 'log' | 'session';

export interface HistoryItem {
  id: number;
  kind?: HistoryKind;
  status?: HistoryStatus;
  timestamp: string;
  truck_plate: string | null;
  volume_liters: number | null;
  duration_minutes: number | null;
  release_method: HistoryReleaseMethod;
  station_name: string | null;
}

export interface HistorySummary {
  count: number;
  total_liters: number;
}

export interface HistoryResponse {
  items: HistoryItem[];
  page: number;
  limit: number;
  total: number;
  summary: HistorySummary;
}
