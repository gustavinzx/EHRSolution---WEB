export type ConnectionMode = 'ONLINE' | 'BLE' | 'OFFLINE';

export type OperationStatus =
  | 'STARTED'
  | 'UNLOCKED'
  | 'FUELING'
  | 'LOCKED'
  | 'COMPLETED'
  | 'PENDING_SYNC'
  | 'SYNCED'
  | 'ERROR';

export interface FuelOperation {
  id: string;
  driverId: string;
  vehicleId: string;
  startedAt: string;
  finishedAt?: string;
  latitude?: number;
  longitude?: number;
  fuelLevelBefore?: number;
  fuelLevelAfter?: number;
  connectionMode: ConnectionMode;
  status: OperationStatus;
}

export interface SyncItem {
  id: string;
  operationId: string;
  createdAt: string;
  attempts: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  payload: FuelOperation;
}