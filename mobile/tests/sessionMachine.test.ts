import { sessionReducer, initialSessionState } from '../src/session/sessionMachine';

describe('sessionMachine', () => {
  it('handles facial success correctly', () => {
    const s1 = sessionReducer(initialSessionState, { type: 'REQUEST_SUCCESS', sessionId: 1, releaseMethod: 'facial' });
    expect(s1.status).toBe('FACIAL_PENDING');

    const s2 = sessionReducer(s1, { type: 'FACIAL_VERIFY_SUCCESS' });
    expect(s2.status).toBe('AUTHORIZING');
  });

  it('handles facial failures and limits', () => {
    const s1 = sessionReducer(initialSessionState, { type: 'REQUEST_SUCCESS', sessionId: 1, releaseMethod: 'facial' });
    
    const s2 = sessionReducer(s1, { type: 'FACIAL_VERIFY_FAIL', attempts: 1, attemptsLeft: 2, error: 'Restam 2' });
    expect(s2.status).toBe('FACIAL_PENDING');
    expect(s2.attemptsLeft).toBe(2);

    const s3 = sessionReducer(s2, { type: 'FACIAL_VERIFY_LOCKED', error: 'Locked' });
    expect(s3.status).toBe('BLOCKED_NEEDS_MANAGER');
  });

  it('handles 409 resumed by status', () => {
    const s1 = sessionReducer(initialSessionState, { type: 'REQUEST_SUCCESS', sessionId: 2, status: 'authorized' });
    expect(s1.status).toBe('WAITING_HARDWARE');

    const s2 = sessionReducer(initialSessionState, { type: 'REQUEST_SUCCESS', sessionId: 2, status: 'active' });
    expect(s2.status).toBe('FUELING');
  });

  it('handles 503 provider error without counting attempts', () => {
    const s1 = sessionReducer({ status: 'FACIAL_PENDING', attemptsLeft: 3 }, { type: 'FACIAL_VERIFY_ERROR', error: '503 erro' });
    expect(s1.status).toBe('FACIAL_PENDING');
    expect(s1.error).toBe('503 erro');
    expect(s1.attemptsLeft).toBe(3); // untouched
  });
});
