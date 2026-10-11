import React, { useEffect, useReducer, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/Button';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { sessionReducer, initialSessionState } from '../session/sessionMachine';
import { useAuth } from '../hooks/useAuth';
import * as Location from 'expo-location';
import { getBleLock } from '../services/bluetooth/bleLock';

type Props = NativeStackScreenProps<RootStackParamList, 'OperationResult'>;

export const OperationResultScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId, initialState, releaseMethod } = route.params;
  const { vehicle } = useAuth();
  
  const [state, dispatch] = useReducer(sessionReducer, {
    ...initialSessionState,
    status: initialState,
    sessionId,
    releaseMethod,
    waitingStartTime: initialState === 'WAITING_HARDWARE' ? Date.now() : undefined,
  });

  const [networkNotice, setNetworkNotice] = useState(false);
  const [canRetryFacial, setCanRetryFacial] = useState(false);
  const isFetching = useRef(false);
  const consecutiveFailures = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    let pollInterval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      if (!vehicle) return;
      pollInterval = setInterval(async () => {
        if (!active) return;
        if (isFetching.current) return;

        // Check 30 min session TTL
        if (state.waitingStartTime && Date.now() - state.waitingStartTime > 30 * 60 * 1000) {
          dispatch({ type: 'POLL_EXPIRED' });
          clearInterval(pollInterval);
          return;
        }

        isFetching.current = true;
        abortControllerRef.current = new AbortController();

        try {
          const session = await apiClient.getActiveSession(vehicle.id);
          if (!active) return;

          // Request succeeded: reset failure count
          consecutiveFailures.current = 0;
          setNetworkNotice(false);

          if (session && session.id === sessionId) {
            if (session.status === 'authorized') {
              dispatch({ type: 'POLL_AUTHORIZED' });
            } else if (session.status === 'active') {
              dispatch({ type: 'POLL_ACTIVE' });
            } else if (session.status === 'cancelled') {
              dispatch({ type: 'POLL_ERROR', error: 'Sessão cancelada.' });
              clearInterval(pollInterval);
            } else if (session.status === 'expired') {
              dispatch({ type: 'POLL_EXPIRED' });
              clearInterval(pollInterval);
            }
          } else {
            // Null or different session
            if (state.status === 'FUELING' || state.status === 'WAITING_HARDWARE' || state.status === 'BLOCKED_NEEDS_MANAGER') {
              dispatch({ type: 'POLL_DONE' });
              clearInterval(pollInterval);
            }
          }
        } catch (e: any) {
          if (!active) return;
          consecutiveFailures.current += 1;
          if (consecutiveFailures.current >= 3) {
            setNetworkNotice(true);
          }
        } finally {
          isFetching.current = false;
        }
      }, 2000);
    };

    if (state.status === 'WAITING_HARDWARE' || state.status === 'FUELING' || state.status === 'BLOCKED_NEEDS_MANAGER') {
      startPolling();
    }

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [state.status, vehicle, sessionId, state.waitingStartTime]);

  useEffect(() => {
    if (state.status === 'AUTHORIZING') {
      const authorize = async () => {
        try {
          if (state.releaseMethod === 'ble_fallback') {
            const bleLock = getBleLock();
            if (!bleLock.isAvailable()) {
              dispatch({ 
                type: 'AUTHORIZE_ERROR', 
                error: 'Esta sessão foi iniciada por Bluetooth, que não está disponível. Procure o gestor.' 
              });
              return;
            }
            await bleLock.connect();
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
          const status = error.status;
          const code = error.code;
          const msg = typeof error.message === 'string' ? error.message : '';

          if (status === 403 && msg.startsWith('Caminhão fora da área do posto autorizado')) {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Caminhão fora da área do posto autorizado.' });
          } else if (status === 403 && code === 'facial_verification_expired') {
            setCanRetryFacial(true);
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Validação facial expirada. Refaça a captura.' });
          } else if (status === 403 && code === 'facial_verification_required') {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Validação facial obrigatória não realizada.' });
          } else if (status === 403 && code === 'facial_verification_already_used') {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Validação facial já utilizada.' });
          } else if (status === 403 && code === 'ble_confirmation_required') {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Confirmação Bluetooth necessária.' });
          } else if (status === 403 && code === 'ble_confirmation_expired') {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Confirmação Bluetooth expirada.' });
          } else if (status === 403 && code === 'ble_confirmation_already_used') {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Confirmação Bluetooth já utilizada.' });
          } else if (status === 404 || status === 409) {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Sessão já processada ou expirada.' });
          } else {
            dispatch({ type: 'AUTHORIZE_ERROR', error: 'Não foi possível autorizar. Tente novamente ou procure o gestor.' });
          }
        }
      };
      authorize();
    }
  }, [state.status, sessionId, state.releaseMethod]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {networkNotice && (
          <View style={styles.networkBanner}>
            <Text style={styles.networkBannerText}>Sem conexão. Tentando novamente...</Text>
          </View>
        )}

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
            <Text style={styles.statusText}>Abastecimento concluído</Text>
            <Text style={styles.subText}>Operação finalizada com sucesso.</Text>
            <Button title="Voltar ao Início" onPress={() => navigation.popToTop()} style={{ marginTop: 20 }} />
          </>
        )}

        {state.status === 'ERROR' && (
          <>
            <Text style={styles.errorText}>{state.error}</Text>
            {canRetryFacial && (
              <Button
                title="Refazer Validação Facial"
                onPress={() => navigation.replace('FacialAuth', { sessionId, status: 'requested', releaseMethod: 'facial' })}
                style={{ marginTop: 10, marginBottom: 10 }}
              />
            )}
            <Button title="Voltar ao Início" onPress={() => navigation.popToTop()} style={{ marginTop: 10 }} />
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
  networkBanner: {
    backgroundColor: theme.colors.warning || '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  networkBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
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