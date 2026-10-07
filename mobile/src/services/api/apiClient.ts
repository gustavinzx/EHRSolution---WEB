import { Driver } from '../../types/driver';
import { Vehicle } from '../../types/vehicle';
import { FuelOperation } from '../../types/operation';

const API_URL = 'http://localhost:3001/api';

export const apiClient = {
  async login(identifier: string, pass: string) {
    const response = await fetch(`${API_URL}/auth/driver/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password: pass })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Credenciais inválidas.');
    }
    
    return await response.json();
  },

  async validateBiometrics(photoBase64: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return true; // Simula validação facial bem sucedida localmente
  },

  async syncOperation(operation: FuelOperation): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return true;
  },
};