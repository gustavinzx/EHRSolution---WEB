import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';

import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FacialAuthScreen } from '../screens/FacialAuthScreen';
import { FuelOperationScreen } from '../screens/FuelOperationScreen';
import { OperationResultScreen } from '../screens/OperationResultScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { signed } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      {!signed ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'EHR — Painel' }} />
          <Stack.Screen name="FacialAuth" component={FacialAuthScreen} options={{ title: 'Validação Facial' }} />
          <Stack.Screen name="FuelOperation" component={FuelOperationScreen} options={{ title: 'Abastecimento' }} />
          <Stack.Screen name="OperationResult" component={OperationResultScreen} options={{ title: 'Resumo' }} />
        </>
      )}
    </Stack.Navigator>
  );
};