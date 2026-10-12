import { sessionReducer, initialSessionState } from '../src/session/sessionMachine';

describe('sessionMachine', () => {
  it('handles REQUEST_START transition', () => {
    const state = sessionReducer(initialSessionState, { type: 'REQUEST_START' });
    expect(state.status).toBe('REQUESTING');
  });

  it('handles REQUEST_SUCCESS with requested status and facial release method', () => {
    const state = sessionReducer(initialSessionState, {
      type: 'REQUEST_SUCCESS',
      sessionId: 10,
      status: 'requested',
      releaseMethod: 'facial',
    });
    expect(state.status).toBe('FACIAL_PENDING');
    expect(state.sessionId).toBe(10);
    expect(state.releaseMethod).toBe('facial');
  });

  it('handles REQUEST_SUCCESS with requested status and ble_fallback (rule C5)', () => {
    const state = sessionReducer(initialSessionState, {
      type: 'REQUEST_SUCCESS',
      sessionId: 11,
      status: 'requested',
      releaseMethod: 'ble_fallback',
    });
    expect(state.status).toBe('AUTHORIZING');
    expect(state.releaseMethod).toBe('ble_fallback');
  });

  it('handles REQUEST_SUCCESS with authorized status (never overwritten by ble_fallback)', () => {
    const stateFacial = sessionReducer(initialSessionState, {
      type: 'REQUEST_SUCCESS',
      sessionId: 12,
      status: 'authorized',
      releaseMethod: 'facial',
    });
    expect(stateFacial.status).toBe('WAITING_HARDWARE');

    const stateBle = sessionReducer(initialSessionState, {
      type: 'REQUEST_SUCCESS',
      sessionId: 13,
      status: 'authorized',
      releaseMethod: 'ble_fallback',
    });
    expect(stateBle.status).toBe('WAITING_HARDWARE');
  });

  it('handles REQUEST_SUCCESS with active status (never overwritten by ble_fallback)', () => {
    const stateFacial = sessionReducer(initialSessionState, {
      type: 'REQUEST_SUCCESS',
      sessionId: 14,
      status: 'active',
      releaseMethod: 'facial',
    });
    expect(stateFacial.status).toBe('FUELING');
    expect(stateFacial.seenActive).toBe(true);

    const stateBle = sessionReducer(initialSessionState, {
      type: 'REQUEST_SUCCESS',
      sessionId: 15,
      status: 'active',
      releaseMethod: 'ble_fallback',
    });
    expect(stateBle.status).toBe('FUELING');
    expect(stateBle.seenActive).toBe(true);
  });

  it('handles REQUEST_ERROR', () => {
    const state = sessionReducer(initialSessionState, {
      type: 'REQUEST_ERROR',
      error: 'Caminhão não encontrado.',
    });
    expect(state.status).toBe('ERROR');
    expect(state.error).toBe('Caminhão não encontrado.');
  });

  it('handles facial verification flow: START, SUCCESS, FAIL, LOCKED, ERROR', () => {
    const start = sessionReducer(initialSessionState, { type: 'FACIAL_VERIFY_START' });
    expect(start.status).toBe('VERIFYING');

    const success = sessionReducer(start, { type: 'FACIAL_VERIFY_SUCCESS' });
    expect(success.status).toBe('AUTHORIZING');

    const fail = sessionReducer(start, {
      type: 'FACIAL_VERIFY_FAIL',
      attempts: 1,
      attemptsLeft: 2,
      error: 'Rosto não reconhecido. Restam 2 tentativa(s).',
    });
    expect(fail.status).toBe('FACIAL_PENDING');
    expect(fail.attempts).toBe(1);
    expect(fail.attemptsLeft).toBe(2);

    const locked = sessionReducer(fail, {
      type: 'FACIAL_VERIFY_LOCKED',
      error: 'Rosto não reconhecido. Tentativas esgotadas.',
    });
    expect(locked.status).toBe('BLOCKED_NEEDS_MANAGER');

    const verifyError = sessionReducer(initialSessionState, {
      type: 'FACIAL_VERIFY_ERROR',
      error: 'Serviço de reconhecimento indisponível.',
    });
    expect(verifyError.status).toBe('FACIAL_PENDING');
    expect(verifyError.error).toBe('Serviço de reconhecimento indisponível.');
  });

  it('handles AUTHORIZE_START, AUTHORIZE_SUCCESS and AUTHORIZE_ERROR', () => {
    const start = sessionReducer(initialSessionState, { type: 'AUTHORIZE_START' });
    expect(start.status).toBe('AUTHORIZING');

    const success = sessionReducer(start, { type: 'AUTHORIZE_SUCCESS' });
    expect(success.status).toBe('WAITING_HARDWARE');
    expect(success.waitingStartTime).toBeDefined();

    const error = sessionReducer(start, {
      type: 'AUTHORIZE_ERROR',
      error: 'Caminhão fora da área do posto autorizado.',
    });
    expect(error.status).toBe('ERROR');
    expect(error.error).toBe('Caminhão fora da área do posto autorizado.');
  });

  it('handles POLL_AUTHORIZED and POLL_ACTIVE', () => {
    const authState = sessionReducer(initialSessionState, { type: 'POLL_AUTHORIZED' });
    expect(authState.status).toBe('WAITING_HARDWARE');

    const activeState = sessionReducer(authState, { type: 'POLL_ACTIVE' });
    expect(activeState.status).toBe('FUELING');
    expect(activeState.seenActive).toBe(true);
  });

  it('distinguishes POLL_DONE with seenActive (DONE) from without seenActive (ERROR)', () => {
    const seenActiveState = { ...initialSessionState, seenActive: true, status: 'FUELING' as const };
    const doneState = sessionReducer(seenActiveState, { type: 'POLL_DONE' });
    expect(doneState.status).toBe('DONE');

    const unactiveState = { ...initialSessionState, seenActive: false, status: 'WAITING_HARDWARE' as const };
    const errorState = sessionReducer(unactiveState, { type: 'POLL_DONE' });
    expect(errorState.status).toBe('ERROR');
    expect(errorState.error).toBe('Sessão encerrada sem abastecimento. Se precisar, inicie novamente.');
  });

  it('handles POLL_EXPIRED and POLL_ERROR', () => {
    const expired = sessionReducer(initialSessionState, { type: 'POLL_EXPIRED' });
    expect(expired.status).toBe('ERROR');
    expect(expired.error).toBe('Tempo da sessão esgotado. Inicie novamente.');

    const error = sessionReducer(initialSessionState, {
      type: 'POLL_ERROR',
      error: 'Sessão cancelada.',
    });
    expect(error.status).toBe('ERROR');
    expect(error.error).toBe('Sessão cancelada.');
  });

  it('handles RESET', () => {
    const modified = { status: 'FUELING' as const, sessionId: 42, seenActive: true };
    const reset = sessionReducer(modified, { type: 'RESET' });
    expect(reset).toEqual(initialSessionState);
  });

  it('handles CANCEL_REQUESTED transitioning to IDLE', () => {
    const pendingState = { ...initialSessionState, status: 'FACIAL_PENDING' as const, sessionId: 42 };
    const state = sessionReducer(pendingState, { type: 'CANCEL_REQUESTED' });
    expect(state.status).toBe('IDLE');
    expect(state).toEqual(initialSessionState);
  });

  it('handles CANCELLED transitioning to IDLE', () => {
    const waitingState = { ...initialSessionState, status: 'WAITING_HARDWARE' as const, sessionId: 42 };
    const state = sessionReducer(waitingState, { type: 'CANCELLED' });
    expect(state.status).toBe('IDLE');
    expect(state).toEqual(initialSessionState);
  });

  it('does not cancel when in FUELING status for CANCEL_REQUESTED', () => {
    const fuelingState = { ...initialSessionState, status: 'FUELING' as const, sessionId: 42, seenActive: true };
    const state = sessionReducer(fuelingState, { type: 'CANCEL_REQUESTED' });
    expect(state.status).toBe('FUELING');
    expect(state.sessionId).toBe(42);
  });

  it('does not cancel when in FUELING status for CANCELLED', () => {
    const fuelingState = { ...initialSessionState, status: 'FUELING' as const, sessionId: 42, seenActive: true };
    const state = sessionReducer(fuelingState, { type: 'CANCELLED' });
    expect(state.status).toBe('FUELING');
    expect(state.sessionId).toBe(42);
  });
});
