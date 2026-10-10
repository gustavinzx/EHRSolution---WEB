export type SessionStatus = 'requested' | 'authorized' | 'active' | 'completed' | 'expired' | 'cancelled';
export type ReleaseMethod = 'facial' | 'ble_fallback' | 'manager_override';

export interface Session {
  id: number;
  truck_id: number;
  driver_id?: number;
  status: SessionStatus;
  release_method?: ReleaseMethod;
  requested_at: string;
  authorized_at?: string;
  started_at?: string;
  completed_at?: string;
  metadata?: any;
}