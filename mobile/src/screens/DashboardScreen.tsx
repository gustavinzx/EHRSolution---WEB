import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { getBleLock } from '../services/bluetooth/bleLock';
import { getCancelErrorMessage } from '../utils/cancelError';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { driver, vehicle, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'inicio' | 'historico' | 'perfil'>('inicio');

  const driverFirstName = driver?.name?.split(' ')[0] || 'Motorista';
  const vehicleCapacity = vehicle?.capacity || 500;
  const fuelPercent = 90;

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

  // Histórico de abastecimentos real / demonstrativo formatado
  const mockHistory = [
    {
      id: 1,
      date: '13/10/2026 • 18:00',
      volume: '450.0 L',
      plate: vehicle?.plate || 'USB04E06',
      method: 'Biometria Facial',
      status: 'Concluído',
      station: 'Posto Rodovia Anhanguera',
    },
    {
      id: 2,
      date: '13/10/2026 • 17:42',
      volume: '500.0 L',
      plate: vehicle?.plate || 'USB04E06',
      method: 'Biometria Facial',
      status: 'Concluído',
      station: 'Posto Central SP',
    },
    {
      id: 3,
      date: '10/10/2026 • 09:15',
      volume: '380.0 L',
      plate: vehicle?.plate || 'USB04E06',
      method: 'Bluetooth Fallback',
      status: 'Concluído',
      station: 'Auto Posto Bandeirantes',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Top Header Light Matching Mockup Screen 2 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDot} />
          <View>
            <Text style={styles.greetingTitle}>Olá, {driverFirstName}!</Text>
            <Text style={styles.greetingSub}>Tudo pronto para abastecer.</Text>
          </View>
        </View>

        {/* Botão de Configuração / Sair no Header */}
        <TouchableOpacity
          style={styles.headerLogoutBtn}
          onPress={signOut}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Sair da conta"
        >
          <Text style={styles.headerLogoutIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ================= ABA 1: INÍCIO ================= */}
        {activeTab === 'inicio' && (
          <View>
            {/* Card "Seu veículo" (Clean truck card with specs, NO car photo) */}
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

                  {/* Metrics Section: Capacidade & Nível Atual */}
                  <View style={styles.metricsContainer}>
                    <View style={styles.metricItem}>
                      <View style={styles.metricLabelRow}>
                        <Text style={styles.metricIcon}>💧</Text>
                        <Text style={styles.metricLabel}>Capacidade</Text>
                      </View>
                      <Text style={styles.metricValue}>
                        {parseFloat(String(vehicleCapacity)).toFixed(1)} L
                      </Text>
                    </View>

                    <View style={styles.metricItem}>
                      <View style={styles.metricLabelRow}>
                        <Text style={styles.metricIcon}>⛽</Text>
                        <Text style={styles.metricLabel}>Nível atual</Text>
                      </View>
                      <Text style={[styles.metricValue, styles.fuelPercentValue]}>
                        {fuelPercent}%
                      </Text>
                    </View>
                  </View>

                  {/* Cyan Level Progress Bar */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${fuelPercent}%` }]} />
                  </View>
                </>
              ) : (
                <Text style={styles.noVehicleText}>Nenhum veículo vinculado. Procure o gestor.</Text>
              )}
            </View>

            {/* Seção de Ações de Abastecimento (Cyan Pill Button) */}
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

            {/* Procedimento de Abastecimento / Info Card */}
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
          <View>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Histórico de Abastecimentos</Text>
              <Text style={styles.historySub}>Seus registros mais recentes</Text>
            </View>

            {/* Summary Banner */}
            <View style={styles.historySummaryCard}>
              <View style={styles.historySummaryCol}>
                <Text style={styles.historySummaryLabel}>Volume Acumulado</Text>
                <Text style={styles.historySummaryValue}>1.330 L</Text>
              </View>
              <View style={styles.historySummaryDivider} />
              <View style={styles.historySummaryCol}>
                <Text style={styles.historySummaryLabel}>Abastecimentos</Text>
                <Text style={styles.historySummaryValue}>3 registrados</Text>
              </View>
            </View>

            {/* Lista de Registros */}
            {mockHistory.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyCardRow}>
                  <View>
                    <Text style={styles.historyCardPlate}>{item.plate}</Text>
                    <Text style={styles.historyCardDate}>{item.date}</Text>
                  </View>
                  <View style={styles.historyCardVolumeBox}>
                    <Text style={styles.historyCardVolume}>{item.volume}</Text>
                    <View style={styles.historyCardStatusBadge}>
                      <Text style={styles.historyCardStatusText}>{item.status}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.historyCardDivider} />
                <View style={styles.historyCardFooter}>
                  <Text style={styles.historyCardStation}>{item.station}</Text>
                  <Text style={styles.historyCardMethod}>{item.method}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ================= ABA 3: PERFIL ================= */}
        {activeTab === 'perfil' && (
          <View>
            {/* Header Perfil com Avatar */}
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
              <Text style={styles.profileName}>{driver?.name || 'Motorista'}</Text>
              <Text style={styles.profileEmail}>{driver?.email || 'motorista@ehr.com'}</Text>
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
                <Text style={styles.profileRowValue}>v1.0.4 • EHR Solutions</Text>
              </View>
            </View>

            {/* Botão Sair da Conta */}
            <View style={{ marginTop: 14 }}>
              <Button
                title="Sair da Conta"
                variant="danger"
                onPress={signOut}
                style={styles.logoutBtn}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Docked Bottom Tab Bar (3 tabs: Início, Histórico, Perfil) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('inicio')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'inicio' && styles.tabIconActive]}>
            🏠
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'inicio' && styles.tabLabelActive]}>
            Início
          </Text>
          {activeTab === 'inicio' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('historico')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'historico' && styles.tabIconActive]}>
            ⏱️
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'historico' && styles.tabLabelActive]}>
            Histórico
          </Text>
          {activeTab === 'historico' && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('perfil')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'perfil' && styles.tabIconActive]}>
            👤
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'perfil' && styles.tabLabelActive]}>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingHorizontal: 22,
    paddingBottom: 16,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  headerLogoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLogoutIcon: {
    fontSize: 18,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 90,
  },

  // Seu Veículo Card
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
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
    color: '#0F172A',
  },
  monitoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
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
    color: '#059669',
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
    backgroundColor: 'rgba(0, 196, 208, 0.12)',
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
    color: '#0F172A',
  },
  plateBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  plateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.8,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
    color: '#64748B',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  fuelPercentValue: {
    color: '#00C4D0',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00C4D0',
    borderRadius: 4,
  },
  noVehicleText: {
    fontSize: 14,
    color: '#64748B',
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
  },
  bleBtn: {
    height: 50,
    borderRadius: 25,
    marginTop: 8,
  },

  // Guide Card
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
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
    color: '#475569',
    flex: 1,
    lineHeight: 18,
  },

  // Histórico
  historyHeader: {
    marginBottom: 14,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  historySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  historySummaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  historySummaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  historySummaryDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  historySummaryLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  historySummaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#00C4D0',
    marginTop: 2,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  historyCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyCardPlate: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyCardDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyCardVolumeBox: {
    alignItems: 'flex-end',
  },
  historyCardVolume: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00C4D0',
  },
  historyCardStatusBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  historyCardStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  historyCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyCardStation: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  historyCardMethod: {
    fontSize: 11,
    color: '#64748B',
  },

  // Perfil
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#00C4D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#00C4D0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  profileAvatarText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  biometricBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 10,
  },
  biometricBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  profileDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
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
    color: '#64748B',
  },
  profileRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  logoutBtn: {
    height: 52,
    borderRadius: 26,
  },

  // Docked Bottom Tab Bar
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 76 : 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 16 : 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    position: 'relative',
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.45,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#00C4D0',
    fontWeight: '800',
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