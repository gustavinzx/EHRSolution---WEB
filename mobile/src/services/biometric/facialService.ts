import { apiClient } from '../api/apiClient';

export const facialService = {
  async processAndValidate(photoUri: string, isOnline: boolean): Promise<boolean> {
    if (!photoUri) return false;

    if (isOnline) {
      // Validação via API Cloud
      return await apiClient.validateBiometrics('base64_placeholder');
    } else {
      // Validação Local/Offline (Simulação de Modelo On-Device)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return true;
    }
  },
};