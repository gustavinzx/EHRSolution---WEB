import { Driver } from './driver';
import { Vehicle } from './vehicle';

export interface LoginResponse {
  token: string;
  driver: Driver;
  vehicle: Vehicle | null;
}

export interface ApiError {
  status: number;
  code?: string;
  message: string;
  session_id?: number;
  session?: any;
}