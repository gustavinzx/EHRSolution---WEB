import {
  getCancelErrorMessage,
  CANCEL_NETWORK_ERROR_MESSAGE,
  CANCEL_GENERIC_ERROR_MESSAGE,
} from '../src/utils/cancelError';

describe('cancelError utility (B1)', () => {
  it('returns network error message when status is 0', () => {
    const error = { status: 0, message: 'Sem conexão com o servidor.' };
    expect(getCancelErrorMessage(error)).toBe(CANCEL_NETWORK_ERROR_MESSAGE);
    expect(getCancelErrorMessage(error)).toBe('Sem conexão. Verifique sua rede e tente novamente.');
  });

  it('returns generic error message when status is 400', () => {
    const error = { status: 400, message: 'id inválido' };
    expect(getCancelErrorMessage(error)).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage(error)).toBe('Não foi possível cancelar o abastecimento. Tente novamente.');
  });

  it('returns generic error message when status is 403', () => {
    const error = { status: 403, message: 'driver_inactive' };
    expect(getCancelErrorMessage(error)).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage(error)).toBe('Não foi possível cancelar o abastecimento. Tente novamente.');
  });

  it('returns generic error message when status is 500', () => {
    const error = { status: 500, message: 'Internal Server Error' };
    expect(getCancelErrorMessage(error)).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage(error)).toBe('Não foi possível cancelar o abastecimento. Tente novamente.');
  });

  it('returns generic error message when status is >= 500 (e.g. 503)', () => {
    const error = { status: 503, message: 'Service Unavailable' };
    expect(getCancelErrorMessage(error)).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage(error)).toBe('Não foi possível cancelar o abastecimento. Tente novamente.');
  });

  it('returns generic error message when error has no status', () => {
    expect(getCancelErrorMessage({})).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage(new Error('Network failure'))).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage(null)).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage(undefined)).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
    expect(getCancelErrorMessage('Falha inesperada')).toBe(CANCEL_GENERIC_ERROR_MESSAGE);
  });
});
