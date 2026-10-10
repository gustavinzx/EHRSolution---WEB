import { Driver } from './driver';
import { Vehicle } from './vehicle';

export interface LoginResponse {
  token: string;
  driver: Driver;
  truck?: Vehicle;
}

export interface ApiError {
  status: number;
  code?: string;
  message: string;
  session_id?: number;
  session?: any;
}