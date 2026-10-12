export const CANCEL_NETWORK_ERROR_MESSAGE = 'Sem conexão. Verifique sua rede e tente novamente.';
export const CANCEL_GENERIC_ERROR_MESSAGE = 'Não foi possível cancelar o abastecimento. Tente novamente.';

export function getCancelErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 0) {
      return CANCEL_NETWORK_ERROR_MESSAGE;
    }
  }
  return CANCEL_GENERIC_ERROR_MESSAGE;
}
