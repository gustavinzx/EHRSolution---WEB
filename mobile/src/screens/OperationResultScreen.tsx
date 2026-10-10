import React, { useEffect, useReducer, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/Button';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { sessionReducer, initialSessionState } from '../session/sessionMachine';
import { useAuth } from '../hooks/useAuth';
import * as Location from 'expo-location';

type Props = NativeStackScreenProps<RootStackParamList, 'OperationResult'>;

export const OperationResultScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId, initialState, releaseMethod } = route.params;
  const { vehicle } = useAuth();
  
  const [state, dispatch] = useReducer(sessionReducer, {
    ...initialSessionState,
    status: initialState,
    sessionId,
    releaseMethod
  });

  const isPolling = useRef(false);

  useEffect(() => {
    let active = true;
    let pollInterval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      if (!vehicle) return;
      isPolling.current = true;
      pollInterval = setInterval(async () => {
        if (!active) return;
        try {
          const session = await apiClient.getActiveSession(vehicle.id);
          if (session && session.id === sessionId) {
            if (session.status === 'authorized') {
              dispatch({ type: 'POLL_AUTHORIZED' });
            } else if (session.status === 'active') {
              dispatch({ type: 'POLL_ACTIVE' });
            }
          } else {
            // Null or different session means it's done or cancelled
            if (state.status === 'FUELING' || state.status === 'WAITING_HARDWARE' || state.status === 'BLOCKED_NEEDS_MANAGER') {
              dispatch({ type: 'POLL_DONE' });
              clearInterval(pollInterval);
            }
          }
        } catch (e) {
          // just retry next time
        }
      }, 2000);
    };

    if (state.status === 'WAITING_HARDWARE' || state.status === 'FUELING' || state.status === 'BLOCKED_NEEDS_MANAGER') {
      startPolling();
    } else {
      isPolling.current = false;
    }

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [state.status, vehicle, sessionId]);

  useEffect(() => {
    if (state.status === 'AUTHORIZING') {
      const authorize = async () => {
        try {
          // If BLE fallback, we mock the bluetooth connection
          if (state.releaseMethod === 'ble_fallback') {
            if (process.env.EXPO_PUBLIC_BLE_MOCK === 'true' && __DEV__) {
              // Mock BLE connect
              await new Promise(r => setTimeout(r, 1000));
            } else {
              dispatch({ type: 'AUTHORIZE_ERROR', error: 'Bluetooth indisponível nesta versão. Peça liberação ao gestor.' });
              return;
            }
          }

          let coords;
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          }
          
          await apiClient.authorizeSession(sessionId, coords);
          dispatch({ type: 'AUTHORIZE_SUCCESS' });
        } catch (error: any) {
          if (error.status === 403 && error.message?.includes('geofence')) {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Caminhão fora da área do posto autorizado.' });
          } else if (error.status === 403 && error.code === 'facial_verification_expired') {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Validação facial expirada. Refaça a captura.' });
          } else if (error.status === 403 && error.code === 'facial_verification_required') {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Validação facial obrigatória não realizada.' });
          } else {
            dispatch({ type: 'AUTHORIZE_ERROR', error: error.message || 'Erro ao autorizar sessão.' });
          }
        }
      };
      authorize();
    }
  }, [state.status, sessionId, state.releaseMethod]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {state.status === 'AUTHORIZING' && (
          <Text style={styles.statusText}>Autorizando na nuvem...</Text>
        )}
        
        {state.status === 'WAITING_HARDWARE' && (
          <>
            <Text style={styles.statusText}>Aguardando liberação da bomba</Text>
            <Text style={styles.subText}>O hardware do caminhão está processando a liberação.</Text>
          </>
        )}
        
        {state.status === 'BLOCKED_NEEDS_MANAGER' && (
          <>
            <Text style={styles.statusText}>Aguardando o gestor liberar manualmente</Text>
            <Text style={styles.subText}>Você excedeu as tentativas faciais. O gestor foi notificado.</Text>
          </>
        )}

        {state.status === 'FUELING' && (
          <Text style={styles.statusText}>Abastecendo...</Text>
        )}

        {state.status === 'DONE' && (
          <>
            <Text style={styles.statusText}>Sessão encerrada</Text>
            <Text style={styles.subText}>Abastecimento concluído ou sessão cancelada.</Text>
            <Button title="Voltar ao Início" onPress={() => navigation.popToTop()} style={{ marginTop: 20 }} />
          </>
        )}

        {state.status === 'ERROR' && (
          <>
            <Text style={styles.errorText}>{state.error}</Text>
            <Button title="Voltar ao Início" onPress={() => navigation.popToTop()} style={{ marginTop: 20 }} />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.white,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
});