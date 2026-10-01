import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncItem, FuelOperation } from '../types/operation';

const QUEUE_KEY = '@ehr_sync_queue';

export const syncQueue = {
  async enqueue(operation: FuelOperation): Promise<SyncItem> {
    const items = await this.getQueue();
    const newItem: SyncItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      operationId: operation.id,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'PENDING',
      payload: operation,
    };

    items.push(newItem);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    return newItem;
  },

  async getQueue(): Promise<SyncItem[]> {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  },

  async updateItemStatus(id: string, status: SyncItem['status']): Promise<void> {
    const items = await this.getQueue();
    const updated = items.map((item) =>
      item.id === id ? { ...item, status, attempts: item.attempts + 1 } : item
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
  },

  async removeItem(id: string): Promise<void> {
    const items = await this.getQueue();
    const filtered = items.filter((item) => item.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },
};