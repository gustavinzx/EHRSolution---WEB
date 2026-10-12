export type SessionStatus = 'requested' | 'authorized' | 'active' | 'completed' | 'expired' | 'cancelled';
export type ReleaseMethod = 'facial' | 'ble_fallback' | 'manager_override';

export interface SessionResult {
  volume_liters: number | null;
  duration_minutes: number | null;
}

export interface Session {
  id: number;
  truck_id: number;
  driver_id?: number;
  status: SessionStatus;
  release_method?: ReleaseMethod;
  station_name?: string | null;
  requested_at: string;
  authorized_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  expires_at?: string;
  result?: SessionResult;
  metadata?: any;
}