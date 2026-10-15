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

  const latestRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadHistory = useCallback(async (page: number = 1, isRefresh: boolean = false, isLoadMore: boolean = false) => {
    const reqId = ++latestRequestIdRef.current;

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
        setHistoryItems(res.items);
      } else {
        setHistoryItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newItems = res.items.filter((i) => !existingIds.has(i.id));
          return [...prev, ...newItems];
        });
      }
      setHistorySummary(res.summary);
      setHistoryTotal(res.total);
      setHistoryPage(res.page);
      setHistoryError(null);
    } catch (err: any) {
      if (!isMountedRef.current || reqId !== latestRequestIdRef.current) return;
      const msg = err?.status === 0
        ? 'Sem conexão. Verifique sua rede e tente novamente.'
        : 'Não foi possível carregar o histórico.';
      setHistoryError(msg);
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
    if (tab === 'historico') {
      loadHistory(1);
    }
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
      {/* Top Header Unificado em Dark Mode */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDot} />
          <View>
            {activeTab === 'inicio' ? (
              <>
                <Text style={styles.greetingTitle}>Olá, {driverFirstName}!</Text>
                <Text style={styles.greetingSub}>Tudo pronto para abastecer.</Text>
              </>
            ) : activeTab === 'historico' ? (
              <>
                <Text style={styles.greetingTitle}>Histórico</Text>
                <Text style={styles.greetingSub}>Registros de abastecimento da frota.</Text>
              </>
            ) : (
              <>
                <Text style={styles.greetingTitle}>Meu Perfil</Text>
                <Text style={styles.greetingSub}>Dados cadastrais e validação facial.</Text>
              </>
            )}
          </View>
        </View>

        {/* Botão de Sair no Header (Sem duplicação de engrenagens) */}
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
              tintColor="#00C4D0"
              colors={['#00C4D0']}
            />
          ) : undefined
        }
      >
        {/* ================= ABA 1: INÍCIO (ABASTECIMENTO) ================= */}
        {activeTab === 'inicio' && (
          <View>
            {/* Card "Seu veículo" em Dark Mode (Clean truck specs, SEM foto de carro) */}
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleCardHeader}>
                <Text style={styles.vehicleCardTitle}>Seu veículo</Text>
                <View style={styles.monitoredBadge}>
                  <View style={styles.monitoredDot} />
                  <Text style={styles.monitoredText}>Monitorado</Text>
                </View>
              </View>

              {vehicle ? (
                <>
                  {/* Vehicle Identity Row (Clean truck badge, model & plate) */}
                  <View style={styles.vehicleIdentityRow}>
                    <View style={styles.truckIconBadge}>
                      <Text style={styles.truckIconSymbol}>🚛</Text>
                    </View>
                    <View style={styles.vehicleInfoCol}>
                      <Text style={styles.vehicleModelText}>{vehicle.model}</Text>
                      <View style={styles.plateBadge}>
                        <Text style={styles.plateText}>{vehicle.plate}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Metrics Section: Capacidade */}
                  <View style={styles.metricsContainer}>
                    <View style={styles.metricItem}>
                      <View style={styles.metricLabelRow}>
                        <Text style={styles.metricIcon}>💧</Text>
                        <Text style={styles.metricLabel}>Capacidade</Text>
                      </View>
                      <Text style={styles.metricValue}>
                        {vehicle.capacity ? `${vehicle.capacity} L` : '—'}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.noVehicleText}>Nenhum veículo vinculado. Procure o gestor.</Text>
              )}
            </View>

            {/* Seção de Ações de Abastecimento (Cyan Pill Destacado) */}
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
              <Text style={styles.guideTitle}>Procedimento de Liberação</Text>

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

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>3</Text>
                </View>
                <Text style={styles.guideStepText}>A bomba é liberada instantaneamente pelo hardware.</Text>
              </View>
            </View>
          </View>
        )}

        {/* ================= ABA 2: HISTÓRICO ================= */}
        {activeTab === 'historico' && (
          <View style={styles.historyContainer}>
            {/* Loading initial state */}
            {historyLoading && historyItems.length === 0 ? (
              <View style={styles.historyLoadingBox} testID="history-loading-indicator">
                <ActivityIndicator size="large" color="#00C4D0" />
                <Text style={styles.historyLoadingText}>Carregando histórico...</Text>
              </View>
            ) : historyError && historyItems.length === 0 ? (
              /* Error state */
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
              /* Empty state */
              <View style={styles.emptyHistoryCard} testID="history-empty-card">
                <View style={styles.emptyHistoryIconBox}>
                  <Text style={styles.emptyHistoryIcon}>⏱️</Text>
                </View>
                <Text style={styles.emptyHistoryText}>
                  Seu histórico de abastecimentos aparecerá aqui.
                </Text>
              </View>
            ) : (
              /* List of items */
              <View>
                {/* Summary Badge at Top */}
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

                {/* Items */}
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

                {/* Load More Button */}
                {historyItems.length < historyTotal && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => loadHistory(historyPage + 1, false, true)}
                    disabled={historyLoadingMore}
                    testID="history-load-more-btn"
                  >
                    {historyLoadingMore ? (
                      <ActivityIndicator size="small" color="#00C4D0" />
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
            {/* Header Perfil com Avatar Centralizado e Borda Verde Biométrica */}
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

              {/* Borda / Badge Indicativa de Biometria Facial Cadastrada */}
              <View style={styles.biometricBadge}>
                <Text style={styles.biometricBadgeText}>✓ Biometria Facial Cadastrada</Text>
              </View>
            </View>

            {/* Informações da Conta */}
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

            {/* Botão Sair da Conta: Reduzida proeminência visual (contorno/fundo sutil vermelho) */}
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

      {/* Docked Bottom Tab Bar (Ícones preenchidos em ciano na rota ativa, inativas em cinza) */}
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
    backgroundColor: '#070D18',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: '#070D18',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C4D0',
    shadowColor: '#00C4D0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 13,
    color: '#8899A6',
    marginTop: 2,
    fontWeight: '500',
  },
  headerLogoutBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 90,
  },

  // Seu Veículo Card Dark Mode
  vehicleCard: {
    backgroundColor: '#0F1A2C',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 18,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  vehicleCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  monitoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  monitoredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
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
    marginBottom: 18,
  },
  truckIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 196, 208, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  truckIconSymbol: {
    fontSize: 24,
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
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#070E1A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  plateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricIcon: {
    fontSize: 12,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8899A6',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 2,
  },
  noVehicleText: {
    fontSize: 14,
    color: '#8899A6',
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Actions
  actionSection: {
    marginBottom: 18,
  },
  startBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#00C4D0',
    borderColor: '#00B4C0',
    shadowColor: '#00C4D0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  bleBtn: {
    height: 50,
    borderRadius: 25,
    marginTop: 8,
  },

  // Guide Card Dark Mode
  guideCard: {
    backgroundColor: '#0F1A2C',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  guideStepNumberBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 196, 208, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00C4D0',
  },
  guideStepText: {
    fontSize: 13,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 18,
  },

  // Histórico
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
    backgroundColor: '#0F1A2C',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
    backgroundColor: 'rgba(0, 196, 208, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.35)',
  },
  retryBtnText: {
    color: '#00C4D0',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyHistoryCard: {
    backgroundColor: '#0F1A2C',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyHistoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 196, 208, 0.1)',
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
    backgroundColor: '#0F1A2C',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  historySummaryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 196, 208, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.3)',
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
    backgroundColor: '#0F1A2C',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
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
    backgroundColor: 'rgba(0, 196, 208, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyMethodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00C4D0',
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
    color: '#00C4D0',
  },
  loadMoreBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreBtnText: {
    color: '#00C4D0',
    fontSize: 13,
    fontWeight: '700',
  },

  // Perfil Dark Mode
  profileHeaderCard: {
    backgroundColor: '#0F1A2C',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.2)',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#070E1A',
    borderWidth: 3,
    borderColor: '#10B981', // Borda indicativa verde de Biometria Facial Cadastrada
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#00C4D0',
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
    backgroundColor: '#0F1A2C',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
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

  // Botão Sair da Conta Sutil
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

  // Docked Bottom Tab Bar em Dark Mode
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 76 : 64,
    backgroundColor: '#0B1322',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 16 : 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
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
    color: '#00C4D0',
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
    backgroundColor: '#00C4D0',
  },
});