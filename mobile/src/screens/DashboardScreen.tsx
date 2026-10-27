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
  Modal,
  TextInput,
  Vibration,
  Switch,
} from 'react-native';
let LocalAuthModule: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthModule = require('expo-local-authentication');
} catch {
  LocalAuthModule = null;
}
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { secureStorage } from '../storage/secureStorage';
import { Button } from '../components/Button';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { getBleLock } from '../services/bluetooth/bleLock';
import { getCancelErrorMessage } from '../utils/cancelError';
import { getBiometricLabel } from '../utils/biometricLabel';
import { HistoryItem, HistorySummary } from '../types/history';
import { WalletResponse, DriverCard, CreateCardPayload } from '../types/wallet';

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

const withDevBiometricDetails = (baseMsg: string, err: any): string => {
  if (__DEV__) {
    const code = err?.originalCode ? String(err.originalCode).trim() : '';
    const message = err?.originalMessage ? String(err.originalMessage).trim() : '';
    const details = [code, message].filter(Boolean).join(' ');
    if (details) {
      return `${baseMsg}\n[dev] ${details}`;
    }
  }
  return baseMsg;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { driver, vehicle, signOut, forgetDevice, enableBiometricLogin, disableBiometricLogin, refreshProfile } = useAuth();
  const [inicioRefreshing, setInicioRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'inicio' | 'historico' | 'carteira' | 'perfil'>('inicio');

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState<HistorySummary | null>(null);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyInlineError, setHistoryInlineError] = useState<string | null>(null);

  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Card Registration State
  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardLimit, setCardLimit] = useState('5000');
  const [cardSaving, setCardSaving] = useState(false);
  const [cardFormError, setCardFormError] = useState<string | null>(null);

  // Biometrics Hardware State
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricTypeName, setBiometricTypeName] = useState('Biometria');
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricOptIn, setBiometricOptIn] = useState(false);

  const loadWallet = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setWalletRefreshing(true);
    } else {
      setWalletLoading(true);
    }
    setWalletError(null);
    try {
      const res = await apiClient.getWallet();
      if (isMountedRef.current) {
        setWalletData(res);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setWalletError(err.message || 'Não foi possível carregar os dados da carteira.');
      }
    } finally {
      if (isMountedRef.current) {
        setWalletLoading(false);
        setWalletRefreshing(false);
      }
    }
  }, []);

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

    async function checkDeviceBiometrics() {
      try {
        const optIn = await secureStorage.getBiometricOptIn();
        if (isMountedRef.current) {
          setBiometricOptIn(Boolean(optIn));
        }

        if (LocalAuthModule) {
          const hasHardware = await LocalAuthModule.hasHardwareAsync();
          const enrolled = await LocalAuthModule.isEnrolledAsync();
          if (isMountedRef.current) {
            setBiometricAvailable(hasHardware);
            setBiometricEnrolled(enrolled);
            if (hasHardware) {
              const types = await LocalAuthModule.supportedAuthenticationTypesAsync();
              setBiometricTypeName(getBiometricLabel(types, Platform.OS));
            }
          }
        }
      } catch (_) {}
    }

    checkDeviceBiometrics().then(async () => {
      try {
        const optIn = await secureStorage.getBiometricOptIn();
        const promptDismissed = await secureStorage.getBiometricPromptDismissed();
        if (LocalAuthModule) {
          const hasHardware = await LocalAuthModule.hasHardwareAsync();
          const enrolled = await LocalAuthModule.isEnrolledAsync();
          if (hasHardware && enrolled && !optIn && !promptDismissed) {
            Alert.alert(
              'Ativar login com biometria?',
              'Deseja habilitar o acesso rápido por biometria neste aparelho?',
              [
                {
                  text: 'Agora não',
                  style: 'cancel',
                  onPress: async () => {
                    await secureStorage.setBiometricPromptDismissed(true);
                  },
                },
                {
                  text: 'Ativar',
                  onPress: async () => {
                    const res = await enableBiometricLogin();
                    if (res.success) {
                      if (isMountedRef.current) {
                        setBiometricOptIn(true);
                      }
                    } else if (!res.canceled && res.error) {
                      const msg = res.error?.message || 'Biometria indisponível neste aparelho. Use e-mail e senha.';
                      Alert.alert('Aviso', withDevBiometricDetails(msg, res.error));
                    }
                  },
                },
              ]
            );
          }
        }
      } catch (_) {}
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleToggleBiometricOptIn = async (value: boolean) => {
    if (value) {
      const res = await enableBiometricLogin();
      if (res.success) {
        setBiometricOptIn(true);
      } else {
        setBiometricOptIn(false);
        if (!res.canceled && res.error) {
          const msg = res.error?.message || 'Biometria indisponível neste aparelho. Use e-mail e senha.';
          Alert.alert('Aviso', withDevBiometricDetails(msg, res.error));
        }
      }
    } else {
      await disableBiometricLogin();
      setBiometricOptIn(false);
    }
  };

  const handleForgetDevice = () => {
    Alert.alert(
      'Esquecer este aparelho?',
      'Isso removerá a biometria cadastrada e todas as preferências salvas neste dispositivo. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Esquecer e Sair',
          style: 'destructive',
          onPress: forgetDevice,
        },
      ]
    );
  };

  const formatCardNumberInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      parts.push(cleaned.slice(i, i + 4));
    }
    setCardNumber(parts.join(' '));
  };

  const formatExpiryInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 3) {
      setCardExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
    } else {
      setCardExpiry(cleaned);
    }
  };

  const detectBrandFromNumber = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('4')) return 'Visa Frota';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'Mastercard Frota';
    if (/^(4011|4389|4514|5041|5066|5067|509|6277|6362|6363)/.test(clean)) return 'Elo Frota';
    return 'Sicoob Card';
  };

  const handleOpenCardModal = () => {
    setCardNumber('');
    setCardHolder(driver?.name ? driver.name.toUpperCase() : '');
    setCardExpiry('');
    setCardCvv('');
    setCardLimit('5000');
    setCardFormError(null);
    setCardModalVisible(true);
  };

  const handleSaveCard = async () => {
    setCardFormError(null);
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      setCardFormError('Informe um número de cartão válido (16 dígitos).');
      return;
    }
    if (!cardHolder.trim()) {
      setCardFormError('Informe o nome do titular impresso no cartão.');
      return;
    }

    const [monthStr, yearStr] = cardExpiry.split('/');
    const month = parseInt(monthStr, 10);
    let year = parseInt(yearStr, 10);
    if (!month || month < 1 || month > 12) {
      setCardFormError('Mês de validade inválido (01 a 12).');
      return;
    }
    if (!year) {
      setCardFormError('Ano de validade inválido (ex: 28).');
      return;
    }
    if (year < 100) year += 2000;

    const limitNum = parseFloat(cardLimit) || 5000;

    setCardSaving(true);
    try {
      await apiClient.addCard({
        cardNumber: cleanNumber,
        cardHolder: cardHolder.trim().toUpperCase(),
        expirationMonth: month,
        expirationYear: year,
        cardBrand: detectBrandFromNumber(cleanNumber),
        bankName: 'Sicoob Credifrotas (756)',
        monthlyLimit: limitNum,
      });

      try {
        Vibration.vibrate([0, 80]);
      } catch (_) {}

      setCardModalVisible(false);
      Alert.alert(
        '💳 Cartão Ativado!',
        `Cartão final ${cleanNumber.slice(-4)} cadastrado e ativado na carteira com sucesso.\nLimite mensal: R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(limitNum)}`
      );
      await loadWallet(true);
    } catch (err: any) {
      setCardFormError(err.message || 'Erro ao cadastrar cartão na carteira.');
    } finally {
      setCardSaving(false);
    }
  };

  const handleDeleteCard = (card: DriverCard) => {
    Alert.alert(
      'Remover Cartão',
      `Deseja realmente desativar o cartão final ${card.lastFour}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteCard(card.id);
              Alert.alert('Sucesso', 'Cartão desativado com sucesso.');
              await loadWallet(true);
            } catch (err: any) {
              Alert.alert('Erro', err.message || 'Falha ao desativar cartão.');
            }
          },
        },
      ]
    );
  };

  const handleSetDefaultCard = async (cardId: number) => {
    try {
      await apiClient.setDefaultCard(cardId);
      await loadWallet(true);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao definir cartão como principal.');
    }
  };

  const handleTestDeviceBiometrics = async () => {
    if (!LocalAuthModule) {
      Alert.alert('Sensor Biométrico', 'Módulo biométrico nativo não disponível neste ambiente.');
      return;
    }

    try {
      const hasHardware = await LocalAuthModule.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert('Sensor Biométrico', 'Nenhum leitor biométrico físico encontrado neste aparelho.');
        return;
      }

      const isEnrolled = await LocalAuthModule.isEnrolledAsync();
      const types = await LocalAuthModule.supportedAuthenticationTypesAsync();
      const typeLabel = types.map((t: number) => {
        if (t === 3) return 'Íris';
        return getBiometricLabel([t], Platform.OS);
      }).join(', ') || 'Sensor Biométrico';

      if (!isEnrolled) {
        Alert.alert(
          'Biometria Não Configurada',
          `Sensor (${typeLabel}) detectado, porém não há digitais/faces cadastradas no sistema operacional do aparelho.`
        );
        return;
      }

      const result = await LocalAuthModule.authenticateAsync({
        promptMessage: `Autentique com ${typeLabel} para validar seu acesso`,
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar Senha',
        disableDeviceFallback: false,
      });

      if (result.success) {
        try {
          Vibration.vibrate([0, 80]);
        } catch (_) {}
        Alert.alert(
          'Biometria Verificada',
          `Seu sensor biométrico (${typeLabel}) está ativo e validado com sucesso.`
        );
      } else {
        if (result.error !== 'user_cancel' && result.error !== 'app_cancel') {
          Alert.alert('Aviso do Sensor', `Leitura não reconhecida (${result.error || 'Cancelado'}).`);
        }
      }
    } catch (err: any) {
      Alert.alert('Erro do Sensor', err?.message || 'Falha ao acionar o sensor biométrico.');
    }
  };

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
      if (typeof refreshProfile === 'function') {
        refreshProfile();
      }
      if (activeTab === 'historico') {
        loadHistory(1);
      } else if (activeTab === 'carteira') {
        loadWallet();
      }
    }, [activeTab, loadHistory, loadWallet, refreshProfile])
  );

  const handleTabPress = (tab: 'inicio' | 'historico' | 'carteira' | 'perfil') => {
    setActiveTab(tab);
    if (tab === 'carteira' && !walletData && !walletLoading) {
      loadWallet();
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
          <RefreshControl
            refreshing={
              activeTab === 'inicio'
                ? inicioRefreshing
                : activeTab === 'historico'
                ? historyRefreshing
                : activeTab === 'carteira'
                ? walletRefreshing
                : false
            }
            onRefresh={async () => {
              if (activeTab === 'inicio') {
                setInicioRefreshing(true);
                if (typeof refreshProfile === 'function') {
                  await refreshProfile();
                }
                setInicioRefreshing(false);
              } else if (activeTab === 'historico') {
                await loadHistory(1, true);
              } else if (activeTab === 'carteira') {
                await loadWallet(true);
              }
            }}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
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

                {historyItems.map((item) => {
                  const itemStatus = item.status || 'completed';
                  const isCancelledOrExpired = itemStatus === 'cancelled' || itemStatus === 'expired';
                  const statusLabel = itemStatus === 'cancelled' ? 'Cancelado' : itemStatus === 'expired' ? 'Expirado' : 'Concluído';
                  const itemKey = `${item.kind || 'log'}-${item.id}`;

                  return (
                    <View key={itemKey} style={styles.historyItemCard} testID={`history-item-${item.id}`}>
                      <View style={styles.historyItemHeader}>
                        <Text style={styles.historyItemDate}>{formatDateTime(item.timestamp)}</Text>
                        {isCancelledOrExpired ? (
                          <View style={styles.historyNeutralBadge} testID={`history-status-badge-${item.id}`}>
                            <Text style={styles.historyNeutralText}>{statusLabel}</Text>
                          </View>
                        ) : (
                          <View style={styles.historyMethodBadge}>
                            <Text style={styles.historyMethodText}>{formatReleaseMethod(item.release_method)}</Text>
                          </View>
                        )}
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

                        {!isCancelledOrExpired && (
                          <View style={styles.historyItemCol}>
                            <View style={styles.historyFieldLabelRow}>
                              <Text style={styles.historyFieldIcon}>⛽</Text>
                              <Text style={styles.historyFieldLabel}>Posto</Text>
                            </View>
                            <Text style={styles.historyFieldValue}>{item.station_name || 'Posto não informado'}</Text>
                          </View>
                        )}
                      </View>

                      {!isCancelledOrExpired && (
                        <>
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
                        </>
                      )}
                    </View>
                  );
                })}

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

        
        {/* ================= ABA CARTEIRA (SICOOB OPEN BANKING) ================= */}
        {activeTab === 'carteira' && (
          <View style={styles.walletContainer}>
            {/* Cartão Corporativo Virtual Sicoob */}
            <View style={styles.virtualCard}>
              <View style={styles.virtualCardHeader}>
                <View style={styles.sicoobBadge}>
                  <Text style={styles.sicoobBadgeText}>SICOOB</Text>
                </View>
                <Text style={styles.virtualCardType}>CARTÃO FROTA PJ</Text>
              </View>

              <View style={styles.virtualCardChipRow}>
                <View style={styles.cardChip}>
                  <View style={styles.cardChipInner} />
                </View>
                <Text style={styles.virtualCardContactless}>📶</Text>
              </View>

              <Text style={styles.virtualCardNumber}>
                •••• •••• •••• {walletData?.activeCard?.lastFour || '4321'}
              </Text>

              <View style={styles.virtualCardFooter}>
                <View>
                  <Text style={styles.virtualCardLabel}>TITULAR</Text>
                  <Text style={styles.virtualCardDriver}>
                    {walletData?.activeCard?.cardHolder || driver?.name?.toUpperCase() || 'MOTORISTA'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.virtualCardLabel}>COOPERATIVA</Text>
                  <Text style={styles.virtualCardBank}>Credifrotas DF (756)</Text>
                </View>
              </View>
            </View>

            {/* Gerenciamento de Cartões Frota */}
            <View style={styles.cardsManagementHeader}>
              <View>
                <Text style={styles.cardsManagementTitle}>Cartões da Frota</Text>
                <Text style={styles.cardsManagementSub}>
                  {walletData?.cards?.length || 0} {(walletData?.cards?.length === 1) ? 'cartão cadastrado' : 'cartões cadastrados'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addCardBtn}
                onPress={handleOpenCardModal}
                activeOpacity={0.8}
                testID="add-card-btn"
              >
                <Text style={styles.addCardBtnIcon}>＋</Text>
                <Text style={styles.addCardBtnText}>Cadastrar Cartão</Text>
              </TouchableOpacity>
            </View>

            {/* Lista ou Prompt Vazio de Cartões */}
            {walletData?.cards && walletData.cards.length > 0 ? (
              <View style={styles.cardsListContainer}>
                {walletData.cards.map((card) => {
                  const isCurrentDefault = card.isDefault;
                  return (
                    <View
                      key={card.id}
                      style={[
                        styles.cardListItem,
                        isCurrentDefault && styles.cardListItemActive,
                      ]}
                      testID={`card-item-${card.id}`}
                    >
                      <View style={styles.cardItemLeft}>
                        <View style={styles.cardItemBrandBadge}>
                          <Text style={styles.cardItemBrandText}>
                            {card.cardBrand.includes('Visa')
                              ? 'VISA'
                              : card.cardBrand.includes('Master')
                              ? 'MC'
                              : card.cardBrand.includes('Elo')
                              ? 'ELO'
                              : 'SICOOB'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, paddingRight: 6 }}>
                          <View style={styles.cardItemTitleRow}>
                            <Text style={styles.cardItemNumber}>•••• {card.lastFour}</Text>
                            {isCurrentDefault && (
                              <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>PADRÃO</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.cardItemHolder} numberOfLines={1}>{card.cardHolder}</Text>
                          <Text style={styles.cardItemLimit}>
                            Limite: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.monthlyLimit)} • Val: {String(card.expirationMonth).padStart(2, '0')}/{String(card.expirationYear).slice(-2)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardItemActions}>
                        {!isCurrentDefault && (
                          <TouchableOpacity
                            style={styles.setDefaultBtn}
                            onPress={() => handleSetDefaultCard(card.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.setDefaultBtnText}>Usar</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.deleteCardBtn}
                          onPress={() => handleDeleteCard(card)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.deleteCardBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noCardsPromptBox}>
                <Text style={styles.noCardsPromptIcon}>💳</Text>
                <Text style={styles.noCardsPromptTitle}>Nenhum cartão cadastrado</Text>
                <Text style={styles.noCardsPromptText}>
                  Cadastre o cartão da sua frota (Sicoob, Visa ou Mastercard) para controlar abastecimentos e limites.
                </Text>
                <TouchableOpacity
                  style={styles.emptyAddCardBtn}
                  onPress={handleOpenCardModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyAddCardBtnText}>+ Cadastrar Primeiro Cartão</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Status Open Banking */}
            <View style={styles.openFinanceBadge}>
              <View style={styles.openFinanceDot} />
              <Text style={styles.openFinanceText}>
                Open Finance Brasil • Conexão Ativa mTLS
              </Text>
            </View>

            {walletLoading && !walletData ? (
              <View style={styles.walletLoadingCard}>
                <ActivityIndicator size="large" color="#00D4FF" />
                <Text style={styles.walletLoadingText}>Consultando saldo e extrato Sicoob...</Text>
              </View>
            ) : walletError ? (
              <View style={styles.walletErrorCard}>
                <Text style={styles.walletErrorText}>{walletError}</Text>
                <TouchableOpacity
                  style={styles.retryWalletBtn}
                  onPress={() => loadWallet(false)}
                >
                  <Text style={styles.retryWalletBtnText}>Tentar Novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Métricas Financeiras */}
                <View style={styles.walletMetricsCard}>
                  <Text style={styles.walletMetricsHeaderLabel}>SALDO DISPONÍVEL P/ COMBUSTÍVEL</Text>
                  <Text style={styles.walletBalanceAmount}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(walletData?.wallet?.balanceAvailable || 0)}
                  </Text>

                  {/* Barra de Consumo do Limite */}
                  <View style={styles.walletProgressTrack}>
                    <View
                      style={[
                        styles.walletProgressFill,
                        {
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((walletData?.wallet?.totalSpentMonth || 0) /
                                (walletData?.wallet?.monthlyCreditLimit || 5000)) *
                                100
                            )
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.walletLimitRow}>
                    <Text style={styles.walletLimitText}>
                      Gasto: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(walletData?.wallet?.totalSpentMonth || 0)}
                    </Text>
                    <Text style={styles.walletLimitText}>
                      Limite: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(walletData?.wallet?.monthlyCreditLimit || 5000)}
                    </Text>
                  </View>

                  <View style={styles.walletSubMetricsGrid}>
                    <View style={styles.walletSubMetricBox}>
                      <Text style={styles.subMetricLabel}>Total Abastecido</Text>
                      <Text style={styles.subMetricValue}>
                        {walletData?.wallet?.totalLitersMonth != null ? walletData.wallet.totalLitersMonth.toFixed(1) : '0'} L
                      </Text>
                    </View>
                    <View style={styles.walletSubMetricBox}>
                      <Text style={styles.subMetricLabel}>Preço ANP Ref.</Text>
                      <Text style={styles.subMetricValue}>
                        R$ {walletData?.wallet?.averagePricePerLiter?.toFixed(2) || '6,05'}/L
                      </Text>
                    </View>
                    <View style={styles.walletSubMetricBox}>
                      <Text style={styles.subMetricLabel}>Operações</Text>
                      <Text style={styles.subMetricValue}>
                        {walletData?.wallet?.fuelingCount || 0}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Extrato / Lançamentos */}
                <View style={styles.walletDisclaimerBox}>
                  <Text style={styles.walletDisclaimerText}>
                    Valores estimados (litros × preço de referência). Não representam cobrança do cartão.
                  </Text>
                </View>
                <View style={styles.walletTransactionsSection}>
                  <Text style={styles.cardSectionTitle}>Extrato de Abastecimentos (Sicoob)</Text>

                  {(!walletData?.transactions || walletData.transactions.length === 0) ? (
                    <View style={styles.walletEmptyCard}>
                      <Text style={styles.walletEmptyIcon}>🧾</Text>
                      <Text style={styles.walletEmptyTitle}>Nenhum lançamento no período</Text>
                      <Text style={styles.walletEmptySub}>
                        Seus abastecimentos registrados aparecerão aqui com o cálculo estimado de consumo.
                      </Text>
                    </View>
                  ) : (
                    walletData.transactions.map((tx) => (
                      <View key={tx.id} style={styles.transactionCard}>
                        <View style={styles.transactionRowTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.transactionStation}>{tx.stationName}</Text>
                            <Text style={styles.transactionDate}>
                              {formatDateTime(tx.timestamp)} • Placa {tx.truckPlate}
                            </Text>
                          </View>
                          <Text style={styles.transactionAmount}>
                            - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.totalAmount)}
                          </Text>
                        </View>

                        <View style={styles.transactionDivider} />

                        <View style={styles.transactionRowBottom}>
                          <Text style={styles.transactionDetail}>
                            {tx.liters.toFixed(2)} L × R$ {tx.pricePerLiter.toFixed(2)}
                          </Text>
                          <View style={styles.transactionStatusBadge}>
                            <Text style={styles.transactionStatusText}>
                              Estimado
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* Info sobre a API Sicoob */}
                <View style={styles.sicoobInfoBox}>
                  <Text style={styles.sicoobInfoTitle}>Integrado via Sicoob Open Banking</Text>
                  <Text style={styles.sicoobInfoText}>
                    Esta carteira sincroniza diretamente com a conta cooperativa {walletData?.bank?.accountNumber || '10987-6'} da frota.
                    Saiba mais no Portal dos Desenvolvedores Sicoob (developers.sicoob.com.br/portal/apis).
                  </Text>
                </View>
              </>
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

            {/* Card Biometria do Smartphone */}
            <View style={[styles.profileDetailsCard, { marginTop: 14 }]}>
              <View style={styles.biometricSectionHeader}>
                <Text style={styles.cardSectionTitle}>Biometria do Smartphone</Text>
                <View
                  style={[
                    styles.biometricStatusIndicator,
                    { backgroundColor: biometricAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.biometricStatusIndicatorText,
                      { color: biometricAvailable ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {biometricAvailable ? '● Hardware Ativo' : '○ Indisponível'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>Sensor Físico</Text>
                <Text style={styles.profileRowValue}>{biometricTypeName}</Text>
              </View>

              <View style={styles.profileDivider} />

              <View style={styles.profileRow}>
                <Text style={styles.profileRowLabel}>Biometria Cadastrada</Text>
                <Text style={[styles.profileRowValue, { color: biometricEnrolled ? '#10B981' : '#F59E0B' }]}>
                  {biometricEnrolled ? 'Ativa no Aparelho' : 'Não Cadastrada no SO'}
                </Text>
              </View>

              {biometricAvailable && biometricEnrolled && (
                <>
                  <View style={styles.profileDivider} />
                  <View style={styles.profileRow}>
                    <Text style={styles.profileRowLabel}>Login por {biometricTypeName}</Text>
                    <Switch
                      value={biometricOptIn}
                      onValueChange={handleToggleBiometricOptIn}
                      trackColor={{ false: '#1E293B', true: '#00D4FF' }}
                      thumbColor={biometricOptIn ? '#FFFFFF' : '#94A3B8'}
                    />
                  </View>
                </>
              )}

              <View style={styles.profileDivider} />

              <TouchableOpacity
                style={styles.testBiometricsProfileBtn}
                onPress={handleTestDeviceBiometrics}
                activeOpacity={0.8}
                testID="test-biometrics-profile-btn"
              >
                <Text style={styles.testBiometricsProfileIcon}>🔐</Text>
                <Text style={styles.testBiometricsProfileText}>
                  Validar Leitor ({biometricTypeName})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16 }}>
              <TouchableOpacity
                onPress={signOut}
                style={styles.subtleLogoutBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.subtleLogoutText}>Sair da Conta</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleForgetDevice}
                style={styles.forgetDeviceBtn}
                activeOpacity={0.8}
                testID="forget-device-btn"
              >
                <Text style={styles.forgetDeviceText}>Sair e esquecer este aparelho</Text>
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
          onPress={() => handleTabPress('carteira')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'carteira' ? styles.tabIconActive : styles.tabIconInactive]}>
            💳
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'carteira' ? styles.tabLabelActive : styles.tabLabelInactive]}>
            Carteira
          </Text>
          {activeTab === 'carteira' && <View style={styles.activeDot} />}
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

      {/* Modal de Cadastro de Cartão Frota */}
      <Modal
        visible={cardModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCardModalVisible(false)}
        testID="card-registration-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Novo Cartão Frota</Text>
                <Text style={styles.modalSubtitle}>Sicoob & Redes Credenciadas PJ</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCardModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                testID="close-card-modal-btn"
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Preview do Cartão no Modal */}
              <View style={styles.miniCardPreview}>
                <View style={styles.miniCardTop}>
                  <Text style={styles.miniCardBrandText}>
                    {cardNumber ? detectBrandFromNumber(cardNumber).toUpperCase() : 'SICOOB CARD'}
                  </Text>
                  <Text style={styles.miniCardChip}>💳</Text>
                </View>
                <Text style={styles.miniCardNumber}>
                  {cardNumber || '•••• •••• •••• ••••'}
                </Text>
                <View style={styles.miniCardBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniCardLabel}>TITULAR</Text>
                    <Text style={styles.miniCardValue} numberOfLines={1}>
                      {cardHolder || 'NOME DO MOTORISTA'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.miniCardLabel}>EXP</Text>
                    <Text style={styles.miniCardValue}>{cardExpiry || 'MM/AA'}</Text>
                  </View>
                </View>
              </View>

              {cardFormError && (
                <View style={styles.modalErrorBox}>
                  <Text style={styles.modalErrorText}>{cardFormError}</Text>
                </View>
              )}

              {/* Formulário de Cartão */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalInputLabel}>Número do Cartão (16 dígitos)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={cardNumber}
                  onChangeText={formatCardNumberInput}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  maxLength={19}
                  testID="input-card-number"
                />
              </View>

              <View style={styles.modalFormGroup}>
                <Text style={styles.modalInputLabel}>Nome Impresso no Cartão</Text>
                <TextInput
                  style={styles.modalInput}
                  value={cardHolder}
                  onChangeText={(t) => setCardHolder(t.toUpperCase())}
                  placeholder="EX: JOAO SILVA FROTA"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                  testID="input-card-holder"
                />
              </View>

              <View style={styles.modalFormRow}>
                <View style={[styles.modalFormGroup, { flex: 1 }]}>
                  <Text style={styles.modalInputLabel}>Validade (MM/AA)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={cardExpiry}
                    onChangeText={formatExpiryInput}
                    placeholder="12/29"
                    placeholderTextColor="#64748B"
                    keyboardType="number-pad"
                    maxLength={5}
                    testID="input-card-expiry"
                  />
                </View>

                <View style={[styles.modalFormGroup, { flex: 1 }]}>
                  <Text style={styles.modalInputLabel}>CVV (Segurança)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={cardCvv}
                    onChangeText={(t) => setCardCvv(t.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    placeholderTextColor="#64748B"
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                    testID="input-card-cvv"
                  />
                </View>
              </View>

              <View style={styles.modalFormGroup}>
                <Text style={styles.modalInputLabel}>Limite Mensal Sugerido (R$)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={cardLimit}
                  onChangeText={(t) => setCardLimit(t.replace(/\D/g, ''))}
                  placeholder="5000"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  testID="input-card-limit"
                />
              </View>

              <View style={styles.modalSecurityNotice}>
                <Text style={styles.modalSecurityIcon}>🔒</Text>
                <Text style={styles.modalSecurityText}>
                  Dados transmitidos com segurança bancária mTLS via Sicoob Open Finance.
                </Text>
              </View>

              {/* Botão de Salvar */}
              <TouchableOpacity
                style={[styles.saveCardSubmitBtn, cardSaving && { opacity: 0.7 }]}
                onPress={handleSaveCard}
                disabled={cardSaving}
                activeOpacity={0.8}
                testID="submit-card-btn"
              >
                {cardSaving ? (
                  <ActivityIndicator size="small" color="#050A14" />
                ) : (
                  <Text style={styles.saveCardSubmitBtnText}>Salvar e Ativar Cartão</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  historyNeutralBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyNeutralText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
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
  forgetDeviceBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  forgetDeviceText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.85,
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

  walletContainer: {
    width: '100%',
  },
  virtualCard: {
    backgroundColor: '#072522',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#00D4FF',
    marginBottom: 14,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  virtualCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sicoobBadge: {
    backgroundColor: '#005542',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7DB61C',
  },
  sicoobBadgeText: {
    color: '#7DB61C',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  virtualCardType: {
    color: '#8899A6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  virtualCardChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardChip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#D4AF37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardChipInner: {
    width: 22,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  virtualCardContactless: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  virtualCardNumber: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  virtualCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  virtualCardLabel: {
    fontSize: 9,
    color: '#8899A6',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  virtualCardDriver: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  virtualCardBank: {
    fontSize: 12,
    color: '#00D4FF',
    fontWeight: '600',
  },
  openFinanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    marginBottom: 16,
  },
  openFinanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  openFinanceText: {
    fontSize: 11,
    color: '#00D4FF',
    fontWeight: '600',
  },
  walletLoadingCard: {
    backgroundColor: '#0B1628',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  walletLoadingText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  walletErrorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  walletErrorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryWalletBtn: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryWalletBtnText: {
    color: '#050A14',
    fontWeight: '700',
    fontSize: 12,
  },
  walletMetricsCard: {
    backgroundColor: '#0B1628',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    marginBottom: 16,
  },
  walletMetricsHeaderLabel: {
    fontSize: 11,
    color: '#8899A6',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  walletBalanceAmount: {
    fontSize: 28,
    color: '#22C55E',
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  walletProgressTrack: {
    height: 8,
    backgroundColor: '#050A14',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  walletProgressFill: {
    height: '100%',
    backgroundColor: '#00D4FF',
    borderRadius: 4,
  },
  walletLimitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  walletLimitText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  walletSubMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  walletSubMetricBox: {
    flex: 1,
    backgroundColor: '#060B13',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  subMetricLabel: {
    fontSize: 10,
    color: '#8899A6',
    marginBottom: 4,
  },
  subMetricValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  walletTransactionsSection: {
    marginBottom: 16,
  },
  walletEmptyCard: {
    backgroundColor: '#0B1628',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  walletEmptyIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  walletEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  walletEmptySub: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  transactionCard: {
    backgroundColor: '#0B1628',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.15)',
    marginBottom: 10,
  },
  transactionRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  transactionStation: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  transactionDate: {
    color: '#64748B',
    fontSize: 11,
  },
  transactionAmount: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
  transactionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  transactionRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionDetail: {
    color: '#94A3B8',
    fontSize: 12,
  },
  transactionStatusBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  transactionStatusText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '600',
  },
  walletDisclaimerBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    marginBottom: 16,
  },
  walletDisclaimerText: {
    color: '#FBBF24',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontWeight: '500',
  },
  sicoobInfoBox: {
    backgroundColor: 'rgba(0, 85, 66, 0.15)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(125, 182, 28, 0.3)',
    marginBottom: 20,
  },
  sicoobInfoTitle: {
    color: '#7DB61C',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  sicoobInfoText: {
    color: '#8899A6',
    fontSize: 11,
    lineHeight: 16,
  },

  // Card Management Section Styles
  cardsManagementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 6,
  },
  cardsManagementTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cardsManagementSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  addCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  addCardBtnIcon: {
    color: '#00D4FF',
    fontSize: 14,
    fontWeight: '800',
  },
  addCardBtnText: {
    color: '#00D4FF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardsListContainer: {
    marginBottom: 16,
    gap: 10,
  },
  cardListItem: {
    backgroundColor: '#0B1628',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardListItemActive: {
    borderColor: 'rgba(0, 212, 255, 0.45)',
    backgroundColor: '#0D1B33',
  },
  cardItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardItemBrandBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#071020',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardItemBrandText: {
    color: '#00D4FF',
    fontSize: 10,
    fontWeight: '800',
  },
  cardItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardItemNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  defaultBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  defaultBadgeText: {
    color: '#22C55E',
    fontSize: 9,
    fontWeight: '800',
  },
  cardItemHolder: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 2,
  },
  cardItemLimit: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
  },
  cardItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setDefaultBtn: {
    backgroundColor: 'rgba(0, 212, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  setDefaultBtnText: {
    color: '#00D4FF',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteCardBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  deleteCardBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  noCardsPromptBox: {
    backgroundColor: '#0B1628',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.15)',
    marginBottom: 16,
  },
  noCardsPromptIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  noCardsPromptTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noCardsPromptText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  emptyAddCardBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyAddCardBtnText: {
    color: '#050A14',
    fontSize: 12,
    fontWeight: '800',
  },

  // Perfil Biometrics Card Styles
  biometricSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  biometricStatusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  biometricStatusIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
  },
  testBiometricsProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.35)',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 6,
    gap: 8,
  },
  testBiometricsProfileIcon: {
    fontSize: 15,
  },
  testBiometricsProfileText: {
    color: '#00D4FF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 12, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0B1628',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#060B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIcon: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  miniCardPreview: {
    backgroundColor: '#062B21',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(125, 182, 28, 0.35)',
  },
  miniCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  miniCardBrandText: {
    color: '#7DB61C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  miniCardChip: {
    fontSize: 20,
  },
  miniCardNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 14,
  },
  miniCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  miniCardLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  miniCardValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 10,
    marginBottom: 14,
  },
  modalErrorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalFormGroup: {
    marginBottom: 14,
  },
  modalFormRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalInputLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  modalInput: {
    backgroundColor: '#060B13',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalSecurityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.15)',
  },
  modalSecurityIcon: {
    fontSize: 16,
  },
  modalSecurityText: {
    color: '#64748B',
    fontSize: 10.5,
    lineHeight: 14,
    flex: 1,
  },
  saveCardSubmitBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 8,
  },
  saveCardSubmitBtnText: {
    color: '#050A14',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

});
