import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'ehr_auth_token';
const DRIVER_KEY = 'ehr_driver_data';

export const secureStorage = {
  async saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  async saveDriver(driver: object): Promise<void> {
    await SecureStore.setItemAsync(DRIVER_KEY, JSON.stringify(driver));
  },

  async getDriver<T>(): Promise<T | null> {
    const data = await SecureStore.getItemAsync(DRIVER_KEY);
    return data ? JSON.parse(data) : null;
  },

  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(DRIVER_KEY);
  },
};