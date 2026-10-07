import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'ehr_auth_token';
const DRIVER_KEY = 'ehr_driver_data';

export const secureStorage = {
  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEY);
  },

  async removeToken(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
  },

  async saveDriver(driver: object): Promise<void> {
    await AsyncStorage.setItem(DRIVER_KEY, JSON.stringify(driver));
  },

  async getDriver<T>(): Promise<T | null> {
    const data = await AsyncStorage.getItem(DRIVER_KEY);
    return data ? JSON.parse(data) : null;
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(DRIVER_KEY);
  },
};