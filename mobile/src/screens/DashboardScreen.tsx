import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { getBleLock } from '../services/bluetooth/bleLock';
import { getCancelErrorMessage } from '../utils/cancelError';
import { HistoryItem, HistorySummary } from '../types/history';

const formatReleaseMethod = (method: string): string => {
  switch (method) {
    case 'facial':
      return 'Facial';
    case 'ble_fallback':
      return 'Contingência Bluetooth';
    case 'manager_override':
      return 'Liberação do gestor';
    default:
      return method;
  }
};

const formatVolume = (liters: number | null): string => {
  if (liters == null) return 'Volume a confirmar';
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(liters)} L`;
};

const formatDateTime = (timestamp: string): string => {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    const dateStr = d.toLocaleDateString('pt-BR');
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return timestamp;
  }
};

const getSummaryText = (summary: HistorySummary | null): string => {
  if (!summary) return 'Últimos 30 dias: 0 abastecimentos • 0 L';
  const count = summary.count;
  const countLabel = `${count} ${count === 1 ? 'abastecimento' : 'abastecimentos'}`;
  let volumeLabel: string;
  if (count > 0 && summary.total_liters === 0) {
    volumeLabel = 'Volume a confirmar';
  } else {
    volumeLabel = `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(summary.total_liters)} L`;
  }
  return `Últimos 30 dias: ${countLabel} • ${volumeLabel}`;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { driver, vehicle, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'inicio' | 'historico' | 'perfil'>('inicio');

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyInlineError, setHistoryInlineError] = useState<string | null>(null);

  const latestRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const hasHistoryItemsRef = useRef(false);
  const lastFailedRequestRef = useRef<{ page: number; isRefresh: boolean; isLoadMore: boolean }>({
    page: 1,
    isRefresh: false,
    isLoadMore: true,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadHistory = useCallback(async (page: number = 1, isRefresh: boolean = false, isLoadMore: boolean = false) => {
    const reqId = ++latestRequestIdRef.current;

    setHistoryInlineError(null);
    if (isRefresh) {
      setHistoryRefreshing(true);
      setHistoryError(null);
    } else if (isLoadMore) {
      setHistoryLoadingMore(true);
    } else {
      setHistoryLoading(true);
      setHistoryError(null);
    }

    try {
      const res = await apiClient.getHistory(page, 20);
      if (!isMountedRef.current || reqId !== latestRequestIdRef.current) return;

      if (page === 1) {
        hasHistoryItemsRef.current = res.items.length > 0;
        setHistoryItems(res.items);
      } else {
        setHistoryItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = res.items.filter((i) => !existingIds.has(i.id));
          const next = [...prev, ...newItems];
          hasHistoryItemsRef.current = next.length > 0;
          return next;
        });
      }
      setHistorySummary(res.summary);
      setHistoryTotal(res.total);
      setHistoryPage(res.page);
      setHistoryError(null);
      setHistoryInlineError(null);
    } catch (err: any) {
      if (!isMountedRef.current || reqId !== latestRequestIdRef.current) return;
      if (isLoadMore || isRefresh || hasHistoryItemsRef.current) {
        lastFailedRequestRef.current = { page, isRefresh, isLoadMore };
        const inlineMsg = err?.status === 0
          ? 'Sem conexão. Verifique sua rede e tente novamente.'
          : 'Não foi possível carregar mais. Toque para tentar de novo.';
        setHistoryInlineError(inlineMsg);
      } else {
        const msg = err?.status === 0
          ? 'Sem conexão. Verifique sua rede e tente novamente.'
          : 'Não foi possível carregar o histórico.';
        setHistoryError(msg);
      }
    } finally {
      if (isMountedRef.current && reqId === latestRequestIdRef.current) {
        setHistoryLoading(false);
        setHistoryRefreshing(false);
        setHistoryLoadingMore(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'historico') {
        loadHistory(1);
      }
    }, [activeTab, loadHistory])
  );

  const handleTabPress = (tab: 'inicio' | 'historico' | 'perfil') => {
    setActiveTab(tab);
  };

  const driverFirstName = driver?.name?.split(' ')[0] || 'Motorista';

  const handleStartOperation = async (releaseMethod: 'facial' | 'ble_fallback' = 'facial') => {
    if (!vehicle) return;
    if (releaseMethod === 'ble_fallback' && !getBleLock().isAvailable()) {
      return;
    }
    setLoading(true);
    try {
      const session = await apiClient.requestSession(vehicle.id, releaseMethod);
      if (session.release_method === 'ble_fallback') {
        navigation.navigate('OperationResult', {
          sessionId: session.id,
          initialState: 'AUTHORIZING',
          releaseMethod: 'ble_fallback',
        });
      } else {
        navigation.navigate('FacialAuth', {
          sessionId: session.id,
          status: session.status,
          releaseMethod: session.release_method,
        });
      }
    } catch (error: any) {
      if (error.status === 409 && error.session) {
        const sess = error.session;

        const resumeSession = () => {
          if (sess.release_method === 'ble_fallback') {
            navigation.navigate('OperationResult', {
              sessionId: sess.id,
              initialState:
                sess.status === 'active'
                  ? 'FUELING'
                  : sess.status === 'authorized'
                  ? 'WAITING_HARDWARE'
                  : 'AUTHORIZING',
              releaseMethod: 'ble_fallback',
            });
          } else {
            navigation.navigate('FacialAuth', {
              sessionId: sess.id,
              status: sess.status,
              releaseMethod: sess.release_method,
            });
          }
        };

        if (sess.status === 'active') {
          navigation.navigate('OperationResult', {
            sessionId: sess.id,
            initialState: 'FUELING',
            releaseMethod: sess.release_method,
          });
          setLoading(false);
          return;
        }

        Alert.alert(
          'Sessão pendente',
          'Já existe uma sessão de abastecimento pendente para este caminhão.',
          [
            {
              text: 'Retomar sessão',
              onPress: resumeSession,
            },
            {
              text: 'Cancelar e começar de novo',
              style: 'destructive',
              onPress: async () => {
                setLoading(true);
                try {
                  await apiClient.cancelSession(sess.id);
                } catch (cancelErr: any) {
                  Alert.alert('Erro', getCancelErrorMessage(cancelErr));
                  setLoading(false);
                  return;
                }

                try {
                  const newSession = await apiClient.requestSession(vehicle.id, releaseMethod);
                  if (newSession.release_method === 'ble_fallback') {
                    navigation.navigate('OperationResult', {
                      sessionId: newSession.id,
                      initialState: 'AUTHORIZING',
                      releaseMethod: 'ble_fallback',
                    });
                  } else {
                    navigation.navigate('FacialAuth', {
                      sessionId: newSession.id,
                      status: newSession.status,
                      releaseMethod: newSession.release_method,
                    });
                  }
                } catch (err: any) {
                  Alert.alert('Erro', err.message || 'Não foi possível reiniciar a sessão.');
                } finally {
                  setLoading(false);
                }
              },
            },
            {
              text: 'Voltar',
              style: 'cancel',
            },
          ]
        );
      } else {
        let msg = error.message;
        if (error.status === 403) msg = 'Caminhão não vinculado a você.';
        if (error.status === 404) msg = 'Caminhão não encontrado.';
        Alert.alert('Erro', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const isBleAvailable = getBleLock().isAvailable();

  return (
    <View style={styles.container}>
      {/* Next-Gen IoT Top Brand Bar */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandIconBadge}>
            <Text style={styles.brandSpeedBars}>≡</Text>
          </View>
          <Text style={styles.brandEhr}>EHR</Text>
          <Text style={styles.brandSolutions}>SOLUTIONS</Text>
          <View style={styles.brandDivider} />
          <View style={styles.driverRoleBadge}>
            <Text style={styles.driverRoleText}>MOTORISTA</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerLogoutBtn}
          onPress={signOut}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Sair da conta"
        >
          <Text style={styles.headerLogoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          activeTab === 'historico' ? (
            <RefreshControl
              refreshing={historyRefreshing}
              onRefresh={() => loadHistory(1, true)}
              tintColor="#00E5FF"
              colors={['#00E5FF']}
            />
          ) : undefined
        }
      >
        {/* ================= ABA 1: INÍCIO (ABASTECIMENTO) ================= */}
        {activeTab === 'inicio' && (
          <View>
            {/* Driver Greeting Banner (Screen 1 Mockup) */}
            <View style={styles.greetingCard}>
              <View style={styles.greetingAvatarBox}>
                <Text style={styles.greetingAvatarText}>
                  {(driver?.name || 'M')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
                <View style={styles.onlineStatusDot} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greetingTitle}>Olá, {driverFirstName}!</Text>
                <Text style={styles.greetingSub}>Bora pra mais uma viagem? Tudo pronto.</Text>
              </View>
            </View>

            {/* Card "SEU CAMINHÃO" em Dark Glassmorphism */}
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleCardHeader}>
                <View>
                  <Text style={styles.vehicleSectionTag}>SEU CAMINHÃO</Text>
                  <Text style={styles.vehicleCardTitle}>Seu veículo</Text>
                </View>
                <View style={styles.monitoredBadge}>
                  <View style={styles.monitoredDot} />
                  <Text style={styles.monitoredText}>Monitorado</Text>
                </View>
              </View>

              {vehicle ? (
                <>
                  {/* Vehicle Identity Row */}
                  <View style={styles.vehicleIdentityRow}>
                    <View style={styles.truckIconBadge}>
                      <Text style={styles.truckIconSymbol}>🚛</Text>
                    </View>
                    <View style={styles.vehicleInfoCol}>
                      <Text style={styles.vehicleModelText}>{vehicle.model}</Text>
                      <View style={styles.plateBadge}>
                        <View style={styles.plateMercosulTopBar} />
                        <Text style={styles.plateText}>{vehicle.plate}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Side-by-Side IoT Telemetry Cards (Capacidade + Trava Eletrônica) */}
                  <View style={styles.iotGridRow}>
                    {/* Card Left: Capacidade Homologada */}
                    <View style={styles.iotModuleCard}>
                      <Text style={styles.iotModuleHeader}>TANQUE HOMOLOGADO</Text>
                      <View style={styles.iotGaugeCircle}>
                        <Text style={styles.iotGaugeSymbol}>⛽</Text>
                      </View>
                      <Text style={styles.metricLabel}>Capacidade</Text>
                      <Text style={styles.metricValue}>
                        {vehicle.capacity ? `${vehicle.capacity} L` : '—'}
                      </Text>
                    </View>

                    {/* Card Right: Trava Eletrônica */}
                    <View style={[styles.iotModuleCard, styles.iotLockCard]}>
                      <Text style={styles.iotModuleHeader}>TRAVA ELETRÔNICA</Text>
                      <View style={styles.iotLockCircle}>
                        <Text style={styles.iotLockSymbol}>🔒</Text>
                      </View>
                      <Text style={styles.iotLockTitle}>Tanque Travado</Text>
                      <Text style={styles.iotLockSub}>Biometria exigida</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.noVehicleText}>Nenhum veículo vinculado. Procure o gestor.</Text>
              )}
            </View>

            {/* Seção de Ações de Abastecimento (Glowing Cyan CTA) */}
            <View style={styles.actionSection}>
              <Button
                testID="main-action-btn"
                title={loading ? 'AGUARDE...' : 'INICIAR ABASTECIMENTO'}
                variant="primary"
                onPress={() => handleStartOperation('facial')}
                style={styles.startBtn}
                disabled={loading || !vehicle}
              />

              {isBleAvailable && (
                <Button
                  testID="ble-action-btn"
                  title="Usar Bluetooth"
                  variant="secondary"
                  onPress={() => handleStartOperation('ble_fallback')}
                  style={styles.bleBtn}
                  disabled={loading || !vehicle}
                />
              )}
            </View>

            {/* Procedimento de Abastecimento / Guia Rápido */}
            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>Procedimento de Liberação IoT</Text>

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>1</Text>
                </View>
                <Text style={styles.guideStepText}>Estacione o caminhão junto à bomba autorizada.</Text>
              </View>

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>2</Text>
                </View>
                <Text style={styles.guideStepText}>Toque em Iniciar e realize a validação facial.</Text>
              </View>

              <View style={[styles.guideStepRow, { marginBottom: 0 }]}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>3</Text>
                </View>
                <Text style={styles.guideStepText}>A trava eletrônica é liberada instantaneamente pelo hardware.</Text>
              </View>
            </View>
          </View>
        )}

        {/* ================= ABA 2: HISTÓRICO ================= */}
        {activeTab === 'historico' && (
          <View style={styles.historyContainer}>
            <View style={styles.sectionHeaderCard}>
              <Text style={styles.greetingTitle}>Histórico</Text>
              <Text style={styles.greetingSub}>Registros de abastecimento da frota.</Text>
            </View>

            {historyLoading && historyItems.length === 0 ? (
              <View style={styles.historyLoadingBox} testID="history-loading-indicator">
                <ActivityIndicator size="large" color="#00E5FF" />
                <Text style={styles.historyLoadingText}>Carregando histórico...</Text>
              </View>
            ) : historyError && historyItems.length === 0 ? (
              <View style={styles.historyErrorBox} testID="history-error-card">
                <Text style={styles.historyErrorIcon}>⚠️</Text>
                <Text style={styles.historyErrorText}>{historyError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadHistory(1)}
                  testID="history-retry-btn"
                >
                  <Text style={styles.retryBtnText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : historyItems.length === 0 ? (
              <View style={styles.emptyHistoryCard} testID="history-empty-card">
                <View style={styles.emptyHistoryIconBox}>
                  <Text style={styles.emptyHistoryIcon}>⏱️</Text>
                </View>
                <Text style={styles.emptyHistoryText}>
                  Seu histórico de abastecimentos aparecerá aqui.
                </Text>
              </View>
            ) : (
              <View>
                <View style={styles.historySummaryCard} testID="history-summary-card">
                  <View style={styles.historySummaryIconBox}>
                    <Text style={styles.historySummaryIcon}>📊</Text>
                  </View>
                  <View style={styles.historySummaryContent}>
                    <Text style={styles.historySummaryTitle}>Resumo</Text>
                    <Text style={styles.historySummaryText} testID="history-summary-text">
                      {getSummaryText(historySummary)}
                    </Text>
                  </View>
                </View>

                {historyItems.map((item) => (
                  <View key={item.id} style={styles.historyItemCard} testID={`history-item-${item.id}`}>
                    <View style={styles.historyItemHeader}>
                      <Text style={styles.historyItemDate}>{formatDateTime(item.timestamp)}</Text>
                      <View style={styles.historyMethodBadge}>
                        <Text style={styles.historyMethodText}>{formatReleaseMethod(item.release_method)}</Text>
                      </View>
                    </View>

                    <View style={styles.historyItemDivider} />

                    <View style={styles.historyItemRow}>
                      <View style={styles.historyItemCol}>
                        <View style={styles.historyFieldLabelRow}>
                          <Text style={styles.historyFieldIcon}>🚛</Text>
                          <Text style={styles.historyFieldLabel}>Veículo</Text>
                        </View>
                        <Text style={styles.historyFieldValue}>{item.truck_plate || '—'}</Text>
                      </View>

                      <View style={styles.historyItemCol}>
                        <View style={styles.historyFieldLabelRow}>
                          <Text style={styles.historyFieldIcon}>⛽</Text>
                          <Text style={styles.historyFieldLabel}>Posto</Text>
                        </View>
                        <Text style={styles.historyFieldValue}>{item.station_name || 'Posto não informado'}</Text>
                      </View>
                    </View>

                    <View style={styles.historyItemDivider} />

                    <View style={styles.historyItemRow}>
                      <View style={styles.historyItemCol}>
                        <View style={styles.historyFieldLabelRow}>
                          <Text style={styles.historyFieldIcon}>💧</Text>
                          <Text style={styles.historyFieldLabel}>Volume</Text>
                        </View>
                        <Text style={styles.historyFieldValueHighlight}>{formatVolume(item.volume_liters)}</Text>
                      </View>

                      {item.duration_minutes != null && (
                        <View style={styles.historyItemCol}>
                          <View style={styles.historyFieldLabelRow}>
                            <Text style={styles.historyFieldIcon}>⏱️</Text>
                            <Text style={styles.historyFieldLabel}>Duração</Text>
                          </View>
                          <Text style={styles.historyFieldValue}>
                            {new Intl.NumberFormat('pt-BR').format(item.duration_minutes)} min
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}

                {historyInlineError && (
                  <View style={styles.historyInlineErrorBox} testID="history-inline-error">
                    <TouchableOpacity
                      style={styles.historyInlineRetryBtn}
                      onPress={() => {
                        const { page, isRefresh, isLoadMore } = lastFailedRequestRef.current;
                        loadHistory(page, isRefresh, isLoadMore);
                      }}
                      testID="history-inline-retry-btn"
                    >
                      <Text style={styles.historyInlineErrorText}>{historyInlineError}</Text>
                      <View style={styles.historyInlineRetryBadge}>
                        <Text style={styles.historyInlineRetryBtnText}>Repetir</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {historyItems.length < historyTotal && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => loadHistory(historyPage + 1, false, true)}
                    disabled={historyLoadingMore}
                    testID="history-load-more-btn"
                  >
                    {historyLoadingMore ? (
                      <ActivityIndicator size="small" color="#00E5FF" />
                    ) : (
                      <Text style={styles.loadMoreBtnText}>Carregar mais</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* ================= ABA 3: PERFIL ================= */}
        {activeTab === 'perfil' && (
          <View>
            <View style={styles.profileHeaderCard}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {(driver?.name || 'M')
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <Text style={styles.profileName}>{driver?.name || 'Não informado'}</Text>
              <Text style={styles.profileEmail}>{driver?.email || 'Não informado'}</Text>

              <View style={styles.biometricBadge}>
                <Text style={styles.biometricBadgeText}>✓ Biometria Facial Cadastrada</Text>
              </View>
            </View>

            <View style={styles.profileDetailsCard}>
              <Text style={styles.cardSectionTitle}>Dados Cadastrais</Text>

              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>Telefone</Text>
                <Text style={styles.profileRowValue}>{driver?.phone || 'Não informado'}</Text>
              </View>

              <View style={styles.profileDivider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>Veículo Vinculado</Text>
                <Text style={styles.profileRowValue}>
                  {vehicle ? `${vehicle.model} (${vehicle.plate})` : 'Nenhum'}
                </Text>
              </View>

              <View style={styles.profileDivider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>Perfil de Acesso</Text>
                <Text style={styles.profileRowValue}>Motorista Autorizado</Text>
              </View>

              <View style={styles.profileDivider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>Versão do App</Text>
                <Text style={styles.profileRowValue}>
                  {Constants.expoConfig?.version ? `v${Constants.expoConfig.version} • EHR Solutions` : 'v1.0.0 • EHR Solutions'}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <TouchableOpacity
                onPress={signOut}
                style={styles.subtleLogoutBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.subtleLogoutText}>Sair da Conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Docked Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabPress('inicio')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'inicio' ? styles.tabIconActive : styles.tabIconInactive]}>
            {activeTab === 'inicio' ? '🔷' : '🔹'}
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'inicio' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            Início
          </Text>
          {activeTab === 'inicio' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabPress('historico')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'historico' ? styles.tabIconActive : styles.tabIconInactive]}>
            {activeTab === 'historico' ? '⏱️' : '🕒'}
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'historico' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            Histórico
          </Text>
          {activeTab === 'historico' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => handleTabPress('perfil')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'perfil' ? styles.tabIconActive : styles.tabIconInactive]}>
            {activeTab === 'perfil' ? '👤' : '🔘'}
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'perfil' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            Perfil
          </Text>
          {activeTab === 'perfil' && <View style={styles.activeDot} />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A14',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#060C18',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.14)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  brandSpeedBars: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '900',
  },
  brandEhr: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.6,
  },
  brandSolutions: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  brandDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginHorizontal: 4,
  },
  driverRoleBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.28)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  driverRoleText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerLogoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoutText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 92,
  },
  greetingCard: {
    backgroundColor: '#0B1628',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  greetingAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#071020',
    borderWidth: 2,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  greetingAvatarText: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '900',
  },
  onlineStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0B1628',
  },
  sectionHeaderCard: {
    marginBottom: 14,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  vehicleCard: {
    backgroundColor: '#0B1628',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
    marginBottom: 16,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  vehicleSectionTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  vehicleCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  monitoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  monitoredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  monitoredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  vehicleIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#071020',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  truckIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckIconSymbol: {
    fontSize: 26,
  },
  vehicleInfoCol: {
    flex: 1,
  },
  vehicleModelText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  plateBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#0F1E36',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    overflow: 'hidden',
  },
  plateMercosulTopBar: {
    height: 4,
    backgroundColor: '#1D4ED8',
    width: '100%',
  },
  plateText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  iotGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iotModuleCard: {
    flex: 1,
    backgroundColor: '#071020',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    alignItems: 'center',
  },
  iotLockCard: {
    borderColor: 'rgba(239, 68, 68, 0.28)',
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  iotModuleHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  iotGaugeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iotGaugeSymbol: {
    fontSize: 22,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  metricValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  iotLockCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iotLockSymbol: {
    fontSize: 22,
  },
  iotLockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F87171',
  },
  iotLockSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
  },
  noVehicleText: {
    fontSize: 14,
    color: '#8899A6',
    textAlign: 'center',
    paddingVertical: 16,
  },
  actionSection: {
    marginBottom: 16,
  },
  startBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#00D4FF',
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  bleBtn: {
    height: 50,
    borderRadius: 16,
    marginTop: 8,
  },
  guideCard: {
    backgroundColor: '#0B1628',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.14)',
  },
  guideTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  guideStepNumberBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00E5FF',
  },
  guideStepText: {
    fontSize: 12.5,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 18,
  },
  historyContainer: {
    paddingBottom: 20,
  },
  historyLoadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  historyLoadingText: {
    fontSize: 14,
    color: '#8899A6',
    fontWeight: '600',
  },
  historyErrorBox: {
    backgroundColor: '#0B1628',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  historyErrorIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  historyErrorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  retryBtnText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyHistoryCard: {
    backgroundColor: '#0B1628',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyHistoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyHistoryIcon: {
    fontSize: 26,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  historySummaryCard: {
    backgroundColor: '#0B1628',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  historySummaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySummaryIcon: {
    fontSize: 20,
  },
  historySummaryContent: {
    flex: 1,
  },
  historySummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8899A6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historySummaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  historyItemCard: {
    backgroundColor: '#0B1628',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.14)',
    marginBottom: 12,
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyItemDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  historyMethodBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyMethodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E5FF',
  },
  historyItemDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  historyItemCol: {
    flex: 1,
  },
  historyFieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  historyFieldIcon: {
    fontSize: 11,
  },
  historyFieldLabel: {
    fontSize: 11,
    color: '#8899A6',
    fontWeight: '600',
  },
  historyFieldValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyFieldValueHighlight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00E5FF',
  },
  loadMoreBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreBtnText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '700',
  },
  historyInlineErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  historyInlineRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyInlineErrorText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '600',
  },
  historyInlineRetryBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  historyInlineRetryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileHeaderCard: {
    backgroundColor: '#0B1628',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.22)',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#071020',
    borderWidth: 3,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#00E5FF',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileEmail: {
    fontSize: 13,
    color: '#8899A6',
    marginTop: 2,
  },
  biometricBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 10,
  },
  biometricBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  profileDetailsCard: {
    backgroundColor: '#0B1628',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.14)',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  profileRowLabel: {
    fontSize: 13,
    color: '#8899A6',
  },
  profileRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  subtleLogoutBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtleLogoutText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 76 : 64,
    backgroundColor: '#070E1C',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 16 : 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    position: 'relative',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabIconInactive: {
    opacity: 0.35,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  tabLabelInactive: {
    color: '#64748B',
    fontWeight: '500',
  },
  activeDot: {
    position: 'absolute',
    top: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
  },
});