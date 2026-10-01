import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/contexts/AuthContext';
import { ConnectionProvider } from './src/contexts/ConnectionContext';
import { OperationProvider } from './src/contexts/OperationContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <ConnectionProvider>
          <AuthProvider>
            <OperationProvider>
              <StatusBar style="auto" />
              <AppNavigator />
            </OperationProvider>
          </AuthProvider>
        </ConnectionProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}