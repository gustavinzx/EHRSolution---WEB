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
      plate: vehicle?.plate || 'U8B04E06',
      method: 'Biometria Facial',
      status: 'Concluído',
      station: 'Posto Rodovia Anhanguera',
    },
    {
      id: 2,
      date: '13/10/2026 • 17:42',
      volume: '500.0 L',
      plate: vehicle?.plate || 'U8B04E06',
      method: 'Biometria Facial',
      status: 'Concluído',
      station: 'Posto Central SP',
    },
    {
      id: 3,
      date: '10/10/2026 • 09:15',
      volume: '380.0 L',
      plate: vehicle?.plate || 'U8B04E06',
      method: 'Bluetooth Fallback',
      status: 'Concluído',
      station: 'Auto Posto Bandeirantes',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Top Header Corporativo */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.companyBadge}>EHR SOLUTIONS</Text>
          <Text style={styles.greetingTitle}>Olá, {driverFirstName}</Text>
          <Text style={styles.greetingSub}>Sistema conectado e operacional</Text>
        </View>

        {/* Botão de Sair no Header */}
        <TouchableOpacity
          style={styles.headerLogoutBtn}
          onPress={signOut}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerLogoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ================= ABA 1: INÍCIO ================= */}
        {activeTab === 'inicio' && (
          <View>
            {/* Card do Veículo Vinculado */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardSectionTitle}>Caminhão Designado</Text>
                <View style={styles.statusOnlineBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusOnlineText}>Monitorado</Text>
                </View>
              </View>

              {vehicle ? (
                <>
                  <View style={styles.vehicleHeaderRow}>
                    <View style={styles.vehicleInfoCol}>
                      <Text style={styles.vehicleModelText}>{vehicle.model}</Text>
                      <View style={styles.plateBadge}>
                        <Text style={styles.plateText}>{vehicle.plate}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Métricas de Capacidade e Nível */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Capacidade Total</Text>
                      <Text style={styles.metricValue}>
                        {parseFloat(String(vehicle.capacity || 500)).toFixed(1)} L
                      </Text>
                    </View>

                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Nível Estimado</Text>
                      <Text style={styles.metricValue}>{fuelPercent}%</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressBar, { width: `${fuelPercent}%` }]} />
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.noVehicleText}>Nenhum veículo vinculado. Procure o gestor.</Text>
              )}
            </View>

            {/* Seção de Ações de Abastecimento */}
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

            {/* Guia de Procedimento Rápido */}
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
                <Text style={styles.guideStepText}>Toque em Iniciar e realize o reconhecimento facial.</Text>
              </View>

              <View style={styles.guideStepRow}>
                <View style={styles.guideStepNumberBox}>
                  <Text style={styles.guideStepNumber}>3</Text>
                </View>
                <Text style={styles.guideStepText}>A trava da bomba destrava automaticamente.</Text>
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
                    <Text style={styles.historyCardStatus}>{item.status}</Text>
                  </View>
                </View>
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
                <Text style={styles.biometricBadgeText}>Biometria Facial Ativa</Text>
              </View>
            </View>

            {/* Informações da Conta */}
            <View style={styles.card}>
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
            <View style={{ marginTop: 10 }}>
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

      {/* Barra de Abas Inferior Profissional (Sem emojis) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'inicio' && styles.tabItemActive]}
          onPress={() => setActiveTab('inicio')}
        >
          <Text style={[styles.tabLabel, activeTab === 'inicio' && styles.tabLabelActive]}>
            Início
          </Text>
          {activeTab === 'inicio' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'historico' && styles.tabItemActive]}
          onPress={() => setActiveTab('historico')}
        >
          <Text style={[styles.tabLabel, activeTab === 'historico' && styles.tabLabelActive]}>
            Histórico
          </Text>
          {activeTab === 'historico' && <View style={styles.activeIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'perfil' && styles.tabItemActive]}
          onPress={() => setActiveTab('perfil')}
        >
          <Text style={[styles.tabLabel, activeTab === 'perfil' && styles.tabLabelActive]}>
            Perfil
          </Text>
          {activeTab === 'perfil' && <View style={styles.activeIndicator} />}
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
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
  },
  companyBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00C4D0',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  greetingSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  headerLogoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  headerLogoutText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  statusOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusOnlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  noVehicleText: {
    fontSize: 14,
    color: '#64748B',
    paddingVertical: 12,
  },
  vehicleHeaderRow: {
    marginBottom: 16,
  },
  vehicleInfoCol: {
    gap: 6,
  },
  vehicleModelText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  plateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  plateText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00C4D0',
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00C4D0',
    borderRadius: 2,
  },
  actionSection: {
    marginBottom: 16,
  },
  startBtn: {
    height: 52,
    borderRadius: 26,
  },
  bleBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 24,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  guideStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  guideStepNumberBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  guideStepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  guideStepText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  historyHeader: {
    marginBottom: 16,
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
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  historySummaryCol: {
    flex: 1,
  },
  historySummaryLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  historySummaryValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#00C4D0',
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  historyCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyCardPlate: {
    fontSize: 14,
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
    fontWeight: '800',
    color: '#00C4D0',
  },
  historyCardStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 2,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyCardStation: {
    fontSize: 11,
    color: '#64748B',
  },
  historyCardMethod: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00C4D0',
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 22,
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
    marginTop: 12,
    backgroundColor: 'rgba(0, 196, 208, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 196, 208, 0.3)',
  },
  biometricBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00838F',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  profileRowLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
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
    height: 48,
    borderRadius: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 20,
    position: 'relative',
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#00C4D0',
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#00C4D0',
  },
});