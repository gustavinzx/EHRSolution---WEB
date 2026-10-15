export type HistoryReleaseMethod = 'facial' | 'ble_fallback' | 'manager_override' | string;

export interface HistoryItem {
  id: number;
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
