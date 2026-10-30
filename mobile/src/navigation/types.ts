import { MachineState } from '../session/sessionMachine';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  FacialAuth: { sessionId: number; status: string; releaseMethod?: 'facial' | 'ble_fallback' | 'manager_override' };
  OperationResult: { sessionId: number; initialState: MachineState; releaseMethod?: 'facial' | 'ble_fallback' | 'manager_override' };
};