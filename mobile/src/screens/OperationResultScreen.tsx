import React, { useEffect, useReducer, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { Button } from '../components/Button';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { sessionReducer, initialSessionState } from '../session/sessionMachine';
import { useAuth } from '../hooks/useAuth';
import * as Location from 'expo-location';
import { getBleLock } from '../services/bluetooth/bleLock';
import { Session } from '../types/session';
import { getCancelErrorMessage } from '../utils/cancelError';

type Props = NativeStackScreenProps<RootStackParamList, 'OperationResult'>;

const FuelingAnimation: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    );

    pulse.start();
    rotate.start();

    return () => {
      pulse.stop();
      rotate.stop();
    };
  }, [pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.animCenter}>
      <Animated.View style={[styles.animGlow, { transform: [{ scale: pulseAnim }] }]} />
      <View style={styles.animCircle}>
        <Animated.View style={[styles.rotatingRing, { transform: [{ rotate: spin }] }]} />
        <View style={styles.iconCenter}>
          <Text style={styles.pumpIconSymbol}>⛽</Text>
        </View>
      </View>
    </View>
  );
};

export const OperationResultScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId, initialState, releaseMethod } = route.params;
  const { vehicle } = useAuth();
  const [canRetryFacial, setCanRetryFacial] = useState(false);
  const [networkNotice, setNetworkNotice] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<Session | null>(null);
  const consecutiveFailures = useRef(0);
  const isFetching = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, dispatch] = useReducer(sessionReducer, {
    ...initialSessionState,
    status: initialState,
    sessionId,
    releaseMethod
  });

  const confirmCancel = () => {
    const alertMsg = state.status === 'WAITING_HARDWARE'
      ? 'Se a bomba já foi liberada, ela será travada novamente.'
      : 'Deseja realmente cancelar o abastecimento?';

    Alert.alert(
      'Cancelar abastecimento',
      alertMsg,
      [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim, cancelar', style: 'destructive', onPress: executeCancel }
      ]
    );
  };

  const executeCancel = async () => {
    try {
      await apiClient.cancelSession(sessionId);
      dispatch({ type: 'CANCELLED' });
      navigation.popToTop();
    } catch (error: any) {
      const status = error.status;
      const msg = typeof error.message === 'string' ? error.message : '';
      const code = error.code;

      if (status === 409 && (msg.includes('em andamento') || code === 'Sessão em andamento não pode ser cancelada')) {
        Alert.alert('Aviso', 'O abastecimento já começou e não pode ser cancelado.');
        dispatch({ type: 'POLL_ACTIVE' });
      } else if (status === 409 && (msg.includes('já foi processada') || code === 'Sessão já foi processada')) {
        try {
          const cur = await apiClient.getSession(sessionId);
          if (cur.status === 'completed') {
            dispatch({ type: 'POLL_DONE' });
          } else if (cur.status === 'active') {
            dispatch({ type: 'POLL_ACTIVE' });
          } else if (cur.status === 'expired') {
            dispatch({ type: 'POLL_EXPIRED' });
          } else {
            navigation.popToTop();
          }
        } catch {
          navigation.popToTop();
        }
      } else if (status === 404) {
        dispatch({ type: 'CANCELLED' });
        navigation.popToTop();
      } else {
        Alert.alert('Erro', getCancelErrorMessage(error));
      }
    }
  };

  useEffect(() => {
    let active = true;
    let pollInterval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      if (!vehicle) return;
      pollInterval = setInterval(async () => {
        if (!active) return;
        if (isFetching.current) return;

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

  useEffect(() => {
    if (state.status === 'DONE') {
      let active = true;
      apiClient.getSession(sessionId)
        .then((s) => {
          if (active) setSessionDetail(s);
        })
        .catch(() => {
          if (active) setSessionDetail(null);
        });
      return () => {
        active = false;
      };
    }
  }, [state.status, sessionId]);

  const canCancel = state.status === 'AUTHORIZING' || state.status === 'WAITING_HARDWARE' || state.status === 'BLOCKED_NEEDS_MANAGER';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.popToTop()}
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.headerTitle}>Operação</Text>
        </TouchableOpacity>

        {canCancel && (
          <TouchableOpacity style={styles.cancelHeaderBtn} onPress={confirmCancel}>
            <Text style={styles.cancelHeaderText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {networkNotice && (
          <View style={styles.networkBanner}>
            <Text style={styles.networkBannerText}>Sem conexão. Tentando novamente...</Text>
          </View>
        )}

        {/* STATE: WAITING HARDWARE OU AUTHORIZING (Screen 4 da referência) */}
        {(state.status === 'AUTHORIZING' || state.status === 'WAITING_HARDWARE') && (
          <View style={styles.centerSection}>
            <FuelingAnimation />

            <Text style={styles.mainTitle}>Aguardando liberação da bomba</Text>
            <Text style={styles.subTitle}>O hardware do caminhão está processando a liberação...</Text>

            {/* Stepper Checklist Card */}
            <View style={styles.stepperCard}>
              <View style={styles.stepRow}>
                <View style={[styles.stepCircle, styles.stepCompleted]}>
                  <Text style={styles.stepCheck}>✓</Text>
                </View>
                <Text style={[styles.stepText, styles.stepTextCompleted]}>Validando identidade</Text>
              </View>

              <View style={styles.stepLine} />

              <View style={styles.stepRow}>
                <View style={[styles.stepCircle, styles.stepActive]}>
                  <Text style={styles.stepSpin}>⟳</Text>
                </View>
                <Text style={[styles.stepText, styles.stepTextActive]}>Comunicando com o dispositivo</Text>
              </View>

              <View style={styles.stepLine} />

              <View style={styles.stepRow}>
                <View style={[styles.stepCircle, styles.stepPending]}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <Text style={[styles.stepText, styles.stepTextPending]}>Liberando abastecimento</Text>
              </View>
            </View>

            {/* Cancel Danger Pill Button */}
            <Button
              testID="cancel-btn"
              title="Cancelar abastecimento"
              variant="danger"
              onPress={confirmCancel}
              style={styles.cancelActionBtn}
            />
          </View>
        )}

        {/* STATE: FUELING (Screen 5 da referência) */}
        {state.status === 'FUELING' && (
          <View style={styles.centerSection}>
            <FuelingAnimation />

            <Text style={styles.mainTitle}>Abastecendo...</Text>
            <Text style={styles.subTitle}>
              Trava liberada e fluxo de combustível ativo. Aguarde a conclusão no bocal.
            </Text>

            {/* Summary Metric Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statIcon}>🚛</Text>
                <Text style={styles.statLabel}>Veículo</Text>
                <Text style={styles.statValue}>{vehicle?.plate || '—'}</Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statIcon}>🛢️</Text>
                <Text style={styles.statLabel}>Capacidade</Text>
                <Text style={styles.statValue}>
                  {vehicle?.capacity ? `${vehicle.capacity} L` : '—'}
                </Text>
              </View>
            </View>

            {/* Safe fueling banner during in progress */}
            <View style={styles.fuelingNoticeCard}>
              <Text style={styles.fuelingNoticeText}>
                ✓ Trava de abastecimento liberada. O fluxo está sendo monitorado pelos sensores.
              </Text>
            </View>
          </View>
        )}

        {/* STATE: DONE (Screen 6 da referência) */}
        {state.status === 'DONE' && (
          <View style={styles.centerSection}>
            {/* Success Check Badge */}
            <View style={styles.successBadge}>
              <Text style={styles.successCheck}>✓</Text>
            </View>

            <Text style={styles.mainTitle}>Abastecimento concluído</Text>
            <Text style={styles.subTitle}>Operação finalizada com sucesso!</Text>

            {/* Receipt Summary Card */}
            {sessionDetail?.result && (
              <View style={styles.receiptCard} testID="result-card">
                <View style={styles.receiptRow}>
                  <View style={styles.receiptLabelRow}>
                    <Text style={styles.receiptIcon}>📄</Text>
                    {sessionDetail.result.volume_liters != null ? (
                      <Text style={styles.receiptValue}>
                        Volume abastecido: {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(sessionDetail.result.volume_liters)} L
                      </Text>
                    ) : (
                      <Text style={styles.receiptPendingText}>
                        O volume ainda será confirmado pela operação.
                      </Text>
                    )}
                  </View>
                </View>

                {sessionDetail.result.duration_minutes != null && (
                  <>
                    <View style={styles.receiptDivider} />
                    <View style={styles.receiptRow}>
                      <View style={styles.receiptLabelRow}>
                        <Text style={styles.receiptIcon}>⏱️</Text>
                        <Text style={styles.receiptValue}>
                          Duração: {new Intl.NumberFormat('pt-BR').format(sessionDetail.result.duration_minutes)} min
                        </Text>
                      </View>
                    </View>
                  </>
                )}

                {sessionDetail.completed_at ? (
                  <>
                    <View style={styles.receiptDivider} />
                    <View style={styles.receiptRow}>
                      <View style={styles.receiptLabelRow}>
                        <Text style={styles.receiptIcon}>📅</Text>
                        <Text style={styles.receiptValue}>
                          Data e hora: {new Date(sessionDetail.completed_at).toLocaleDateString('pt-BR')}, {new Date(sessionDetail.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : null}
              </View>
            )}

            {/* Actions matching Screen 6 */}
            <Button
              title="Voltar ao Início"
              variant="primary"
              onPress={() => navigation.popToTop()}
              style={styles.doneBtn}
            />

            <Button
              title="Ver Histórico"
              variant="secondary"
              onPress={() => navigation.popToTop()}
              style={styles.historyBtn}
            />
          </View>
        )}

        {/* STATE: BLOCKED OR ERROR */}
        {state.status === 'BLOCKED_NEEDS_MANAGER' && (
          <View style={styles.centerSection}>
            <View style={[styles.successBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' }]}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#F59E0B' }}>!</Text>
            </View>
            <Text style={styles.mainTitle}>Aguardando liberação do gestor</Text>
            <Text style={styles.subTitle}>Você excedeu as tentativas faciais. O gestor foi notificado.</Text>
            <Button
              testID="cancel-btn"
              title="Cancelar abastecimento"
              variant="danger"
              onPress={confirmCancel}
              style={styles.cancelActionBtn}
            />
          </View>
        )}

        {state.status === 'ERROR' && (
          <View style={styles.centerSection}>
            <View style={[styles.successBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444' }]}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#EF4444' }}>×</Text>
            </View>
            <Text style={[styles.mainTitle, { color: '#EF4444' }]}>Ocorreu um erro</Text>
            <Text style={styles.subTitle}>{state.error}</Text>

            {canRetryFacial && (
              <Button
                title="Refazer Validação Facial"
                variant="primary"
                onPress={() => navigation.replace('FacialAuth', { sessionId, status: 'requested', releaseMethod: 'facial' })}
                style={styles.doneBtn}
              />
            )}

            {sessionId != null && (
              <Button
                testID="cancel-session-error-btn"
                title="Cancelar sessão"
                variant="danger"
                onPress={executeCancel}
                style={styles.cancelActionBtn}
              />
            )}

            <Button
              title="Voltar ao Início"
              variant="secondary"
              onPress={() => navigation.popToTop()}
              style={styles.historyBtn}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D18',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#070D18',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backArrow: {
    fontSize: 26,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  centerSection: {
    alignItems: 'center',
    width: '100%',
  },
  animCenter: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 140,
    marginVertical: 16,
  },
  animGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0, 196, 208, 0.15)',
  },
  animCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#0F1A2C',
    borderWidth: 4,
    borderColor: 'rgba(0, 196, 208, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C4D0',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  rotatingRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#00C4D0',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pumpIconSymbol: {
    fontSize: 34,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
  },
  subTitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  stepperCard: {
    width: '100%',
    backgroundColor: '#0F1A2C',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCompleted: {
    backgroundColor: '#10B981',
  },
  stepCheck: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  stepActive: {
    backgroundColor: 'rgba(0, 196, 208, 0.15)',
    borderWidth: 1.5,
    borderColor: '#00C4D0',
  },
  stepSpin: {
    color: '#00C4D0',
    fontWeight: '800',
    fontSize: 14,
  },
  stepPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  stepNumber: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 12,
  },
  stepLine: {
    width: 2,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: 13,
    marginVertical: 4,
  },
  stepText: {
    fontSize: 14,
  },
  stepTextCompleted: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stepTextActive: {
    color: '#00C4D0',
    fontWeight: '700',
  },
  stepTextPending: {
    color: '#64748B',
    fontWeight: '500',
  },
  fuelVolumeText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#00C4D0',
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: -0.5,
  },
  fuelTimeText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  fuelProgressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 20,
  },
  fuelProgressBar: {
    width: '65%',
    height: '100%',
    backgroundColor: '#00C4D0',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0F1A2C',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  fuelingNoticeCard: {
    backgroundColor: 'rgba(0, 196, 208, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.25)',
    borderRadius: 14,
    padding: 14,
    width: '100%',
  },
  fuelingNoticeText: {
    fontSize: 12,
    color: '#00C4D0',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 196, 208, 0.15)',
    borderWidth: 3,
    borderColor: '#00C4D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  successCheck: {
    fontSize: 36,
    color: '#00C4D0',
    fontWeight: '900',
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#0F1A2C',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 2,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  receiptLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptIcon: {
    fontSize: 14,
  },
  receiptLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  receiptValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  receiptPendingText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cancelActionBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    marginTop: 8,
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  doneBtn: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    marginTop: 8,
    backgroundColor: '#00C4D0',
    borderColor: '#00B4C0',
  },
  historyBtn: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    marginTop: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  networkBanner: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    width: '100%',
  },
  networkBannerText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
});