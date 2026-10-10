export type MachineState = 
  | 'IDLE' 
  | 'REQUESTING' 
  | 'FACIAL_PENDING' 
  | 'VERIFYING' 
  | 'AUTHORIZING' 
  | 'WAITING_HARDWARE' 
  | 'FUELING' 
  | 'DONE' 
  | 'BLOCKED_NEEDS_MANAGER' 
  | 'ERROR';

export interface SessionState {
  status: MachineState;
  sessionId?: number;
  error?: string;
  attempts?: number;
  attemptsLeft?: number;
  releaseMethod?: 'facial' | 'ble_fallback' | 'manager_override';
}

export type SessionAction =
  | { type: 'REQUEST_START' }
  | { type: 'REQUEST_SUCCESS'; sessionId: number; releaseMethod?: 'facial' | 'ble_fallback' | 'manager_override'; status?: string }
  | { type: 'REQUEST_ERROR'; error: string }
  | { type: 'FACIAL_VERIFY_START' }
  | { type: 'FACIAL_VERIFY_SUCCESS' }
  | { type: 'FACIAL_VERIFY_FAIL'; attempts: number; attemptsLeft: number; error?: string }
  | { type: 'FACIAL_VERIFY_LOCKED'; error?: string }
  | { type: 'FACIAL_VERIFY_ERROR'; error: string }
  | { type: 'AUTHORIZE_START' }
  | { type: 'AUTHORIZE_SUCCESS' }
  | { type: 'AUTHORIZE_ERROR'; error: string }
  | { type: 'POLL_ACTIVE' }
  | { type: 'POLL_DONE' }
  | { type: 'POLL_AUTHORIZED' }
  | { type: 'RESET' };

export const initialSessionState: SessionState = {
  status: 'IDLE',
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'REQUEST_START':
      return { status: 'REQUESTING' };
    case 'REQUEST_SUCCESS': {
      let nextStatus: MachineState = 'FACIAL_PENDING';
      if (action.status === 'authorized') nextStatus = 'WAITING_HARDWARE';
      if (action.status === 'active') nextStatus = 'FUELING';
      if (action.releaseMethod === 'ble_fallback') nextStatus = 'AUTHORIZING';
      return { status: nextStatus, sessionId: action.sessionId, releaseMethod: action.releaseMethod };
    }
    case 'REQUEST_ERROR':
      return { status: 'ERROR', error: action.error };
    case 'FACIAL_VERIFY_START':
      return { ...state, status: 'VERIFYING', error: undefined };
    case 'FACIAL_VERIFY_SUCCESS':
      return { ...state, status: 'AUTHORIZING', error: undefined };
    case 'FACIAL_VERIFY_FAIL':
      return { ...state, status: 'FACIAL_PENDING', attempts: action.attempts, attemptsLeft: action.attemptsLeft, error: action.error };
    case 'FACIAL_VERIFY_LOCKED':
      return { ...state, status: 'BLOCKED_NEEDS_MANAGER', error: action.error };
    case 'FACIAL_VERIFY_ERROR':
      // like 503, just go back to pending but show error
      return { ...state, status: 'FACIAL_PENDING', error: action.error };
    case 'AUTHORIZE_START':
      return { ...state, status: 'AUTHORIZING', error: undefined };
    case 'AUTHORIZE_SUCCESS':
      return { ...state, status: 'WAITING_HARDWARE', error: undefined };
    case 'AUTHORIZE_ERROR':
      return { ...state, status: 'ERROR', error: action.error };
    case 'POLL_AUTHORIZED':
      return { ...state, status: 'WAITING_HARDWARE' };
    case 'POLL_ACTIVE':
      return { ...state, status: 'FUELING' };
    case 'POLL_DONE':
      return { ...state, status: 'DONE' };
    case 'RESET':
      return initialSessionState;
    default:
      return state;
  }
}
