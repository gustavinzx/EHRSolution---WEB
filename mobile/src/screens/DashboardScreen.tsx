import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, Platform } from 'react-native';
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

  const driverFirstName = driver?.name?.split(' ')[0] || 'Gustavo';
  const vehicleModel = vehicle?.model || 'Hyundai Azera';
  const vehiclePlate = vehicle?.plate || 'USB04E06';
  const vehicleCapacity = vehicle?.capacity || 500;
  const fuelPercent = 90; // Default preview level

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
          releaseMethod: 'ble_fallback'
        });
      } else {
        navigation.navigate('FacialAuth', { sessionId: session.id, status: session.status, releaseMethod: session.release_method });
      }
    } catch (error: any) {
      if (error.status === 409 && error.session) {
        const sess = error.session;

        const resumeSession = () => {
          if (sess.release_method === 'ble_fallback') {
            navigation.navigate('OperationResult', {
              sessionId: sess.id,
              initialState: sess.status === 'active' ? 'FUELING' : sess.status === 'authorized' ? 'WAITING_HARDWARE' : 'AUTHORIZING',
              releaseMethod: 'ble_fallback'
            });
          } else {
            navigation.navigate('FacialAuth', { 
              sessionId: sess.id, 
              status: sess.status, 
              releaseMethod: sess.release_method 
            });
          }
        };

        if (sess.status === 'active') {
          navigation.navigate('OperationResult', {
            sessionId: sess.id,
            initialState: 'FUELING',
            releaseMethod: sess.release_method
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
                      releaseMethod: 'ble_fallback'
                    });
                  } else {
                    navigation.navigate('FacialAuth', {
                      sessionId: newSession.id,
                      status: newSession.status,
                      releaseMethod: newSession.release_method
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

  const handleSettingsPress = () => {
    Alert.alert(
      'Opções',
      `Motorista: ${driver?.name || 'Não identificado'}\nE-mail: ${driver?.email || '-'}`,
      [
        { text: 'Sair da conta', style: 'destructive', onPress: signOut },
        { text: 'Fechar', style: 'cancel' }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingTitle}>Olá, {driverFirstName}! 👋</Text>
          <Text style={styles.greetingSub}>Tudo pronto para abastecer.</Text>
        </View>

        <TouchableOpacity 
          style={styles.settingsBtn} 
          onPress={handleSettingsPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Card: Seu veículo */}
        <View style={styles.vehicleCard}>
          <Text style={styles.cardSectionTitle}>Seu veículo</Text>

          {vehicle ? (
            <>
              <View style={styles.vehicleHeaderRow}>
                <View style={styles.vehicleInfoCol}>
                  <View style={styles.carBadgeRow}>
                    <View style={styles.carIconBox}>
                      <Text style={styles.carIconText}>🚗</Text>
                    </View>
                    <View>
                      <Text style={styles.vehicleModelText}>{vehicle.model}</Text>
                      <Text style={styles.vehiclePlateText}>{vehicle.plate}</Text>
                    </View>
                  </View>
                </View>

                {/* Vehicle preview image */}
                <View style={styles.vehicleImageWrapper}>
                  <Image
                    source={require('../../assets/vehicle-preview.png')}
                    style={styles.vehicleImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              {/* Metric Chips Row */}
              <View style={styles.metricsRow}>
                {/* Capacidade */}
                <View style={styles.metricChip}>
                  <View style={styles.metricIconBox}>
                    <Text style={styles.metricEmoji}>⛽</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metricLabel}>Capacidade</Text>
                    <Text style={styles.metricValue}>{parseFloat(String(vehicle.capacity || 500)).toFixed(1)} L</Text>
                  </View>
                </View>

                {/* Nível atual */}
                <View style={styles.metricChip}>
                  <View style={styles.metricIconBox}>
                    <Text style={styles.metricEmoji}>📊</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metricLabel}>Nível atual</Text>
                    <Text style={styles.metricValue}>{fuelPercent}%</Text>
                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${fuelPercent}%` }]} />
                    </View>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.noVehicleText}>Nenhum veículo vinculado. Procure o gestor.</Text>
          )}
        </View>

        {/* Action Button: Iniciar Abastecimento */}
        <View style={styles.actionSection}>
          <Button
            testID="main-action-btn"
            title={loading ? "AGUARDE..." : "INICIAR ABASTECIMENTO"}
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
              style={{ marginTop: 12, height: 50, borderRadius: 25 }}
              disabled={loading || !vehicle}
            />
          )}
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('inicio')}
        >
          <Text style={[styles.tabIcon, activeTab === 'inicio' && styles.tabIconActive]}>🏠</Text>
          <Text style={[styles.tabLabel, activeTab === 'inicio' && styles.tabLabelActive]}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('historico')}
        >
          <Text style={[styles.tabIcon, activeTab === 'historico' && styles.tabIconActive]}>🕒</Text>
          <Text style={[styles.tabLabel, activeTab === 'historico' && styles.tabLabelActive]}>Histórico</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('perfil')}
        >
          <Text style={[styles.tabIcon, activeTab === 'perfil' && styles.tabIconActive]}>👤</Text>
          <Text style={[styles.tabLabel, activeTab === 'perfil' && styles.tabLabelActive]}>Perfil</Text>
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
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  greetingSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 14,
  },
  noVehicleText: {
    fontSize: 14,
    color: '#64748B',
    paddingVertical: 12,
  },
  vehicleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  vehicleInfoCol: {
    flex: 1,
  },
  carBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  carIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 196, 208, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carIconText: {
    fontSize: 18,
  },
  vehicleModelText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehiclePlateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  vehicleImageWrapper: {
    width: 80,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleImage: {
    width: 80,
    height: 50,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricEmoji: {
    fontSize: 14,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00C4D0',
    marginTop: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00C4D0',
    borderRadius: 2,
  },
  actionSection: {
    marginTop: 24,
  },
  startBtn: {
    height: 54,
    borderRadius: 27,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#00C4D0',
    fontWeight: '700',
  },
});