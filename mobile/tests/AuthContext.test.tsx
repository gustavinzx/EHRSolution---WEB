import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AuthProvider, AuthContext } from '../src/contexts/AuthContext';
import { secureStorage } from '../src/storage/secureStorage';
import { Text, View } from 'react-native';

jest.mock('../src/storage/secureStorage', () => ({
  secureStorage: {
    getToken: jest.fn(),
    getDriver: jest.fn(),
    getVehicle: jest.fn(),
    clearAll: jest.fn(),
  }
}));

describe('AuthContext', () => {
  it('restores vehicle and driver from storage', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue('token');
    (secureStorage.getDriver as jest.Mock).mockResolvedValue({ id: 1, name: 'João' });
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue({ id: 10, plate: 'ABC-1234' });

    const { getByText } = render(
      <AuthProvider>
        <AuthContext.Consumer>
          {({ driver, vehicle }) => (
            <View>
              <Text>{driver?.name || 'no-driver'}</Text>
              <Text>{vehicle?.plate || 'no-vehicle'}</Text>
            </View>
          )}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByText('João')).toBeTruthy();
      expect(getByText('ABC-1234')).toBeTruthy();
    });
  });

  it('onUnauthorized clears storage', async () => {
    (secureStorage.getToken as jest.Mock).mockResolvedValue(null);
    (secureStorage.getDriver as jest.Mock).mockResolvedValue(null);
    (secureStorage.getVehicle as jest.Mock).mockResolvedValue(null);

    let contextRef: any;

    render(
      <AuthProvider>
        <AuthContext.Consumer>
          {value => {
            contextRef = value;
            return null;
          }}
        </AuthContext.Consumer>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(contextRef.loading).toBe(false);
    });

    act(() => {
      contextRef.onUnauthorized();
    });

    expect(secureStorage.clearAll).toHaveBeenCalled();
  });
});
