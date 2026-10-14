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
import Constants from 'expo-constants';
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

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
          <View style={styles.emptyHistoryCard}>
            <View style={styles.emptyHistoryIconBox}>
              <Text style={styles.emptyHistoryIcon}>⏱️</Text>
            </View>
            <Text style={styles.emptyHistoryText}>
              Seu histórico de abastecimentos aparecerá aqui.
            </Text>
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
          onPress={() => setActiveTab('inicio')}
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
          onPress={() => setActiveTab('historico')}
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
          onPress={() => setActiveTab('perfil')}
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