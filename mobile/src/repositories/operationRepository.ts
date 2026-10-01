import AsyncStorage from '@react-native-async-storage/async-storage';
import { FuelOperation } from '../types/operation';

const OPERATIONS_KEY = '@ehr_local_operations';

export const operationRepository = {
  async saveLocal(operation: FuelOperation): Promise<void> {
    const existing = await this.getAllLocal();
    const index = existing.findIndex((o) => o.id === operation.id);

    if (index >= 0) {
      existing[index] = operation;
    } else {
      existing.push(operation);
    }

    await AsyncStorage.setItem(OPERATIONS_KEY, JSON.stringify(existing));
  },

  async getAllLocal(): Promise<FuelOperation[]> {
    const data = await AsyncStorage.getItem(OPERATIONS_KEY);
    return data ? JSON.parse(data) : [];
  },
};