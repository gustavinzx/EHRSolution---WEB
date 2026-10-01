import { Driver } from '../../types/driver';
import { Vehicle } from '../../types/vehicle';
import { FuelOperation } from '../../types/operation';

// MOCK API CLIENT — Mapeia o contrato futuro do servidor Node.js / Express
export const apiClient = {
  async login(identifier: string, pass: string) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (identifier === 'error') {
      throw new Error('Credenciais inválidas.');
    }
    return {
      token: 'jwt_mock_token_ehr_solutions_2026',
      driver: {
        id: 'drv_101',
        name: 'Carlos Eduardo Santos',
        cpf: '123.456.789-00',
        registration: 'MTR-9942',
        vehicleId: 'vec_550',
      } as Driver,
      vehicle: {
        id: 'vec_550',
        plate: 'EHR-2A26',
        model: 'Constellation 24.280',
        brand: 'Volkswagen',
        bleDeviceId: 'BLE-TRAVA-EHR-01',
      } as Vehicle,
    };
  },

  async validateBiometrics(photoBase64: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true; // Simula validação facial bem sucedida no servidor
  },

  async syncOperation(operation: FuelOperation): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return true;
  },
};