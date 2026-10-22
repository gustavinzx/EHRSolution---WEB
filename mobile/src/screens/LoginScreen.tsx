import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
let LocalAuthModule: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthModule = require('expo-local-authentication');
} catch {
  LocalAuthModule = null;
}
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { getBaseUrl, apiClient } from '../services/api/apiClient';
import { secureStorage } from '../storage/secureStorage';

export const LoginScreen: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometria');
  const [biometricLoginReady, setBiometricLoginReady] = useState(false);
  const [biometricOptInChecked, setBiometricOptInChecked] = useState(false);
  const { signIn, unlockSession } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function initBiometricsAndSession() {
      try {
        // Limpa credenciais legadas na inicialização (migração de segurança)
        await secureStorage.cleanupLegacyCredentials();

        let deviceReady = false;
        if (LocalAuthModule) {
          const hasHardware = await LocalAuthModule.hasHardwareAsync();
          const isEnrolled = await LocalAuthModule.isEnrolledAsync();

          if (isMounted && hasHardware && isEnrolled) {
            deviceReady = true;
            setBiometricAvailable(true);
            const supportedTypes = await LocalAuthModule.supportedAuthenticationTypesAsync();
            if (supportedTypes.includes(2)) {
              setBiometricType('Face ID');
            } else if (supportedTypes.includes(1)) {
              setBiometricType('Digital');
            } else {
              setBiometricType('Biometria');
            }
          }
        }

        const rememberedEmail = await secureStorage.getRememberedEmail();
        const optIn = await secureStorage.getBiometricOptIn();
        const storedToken = await secureStorage.getToken();
        const storedDriver = await secureStorage.getDriver();

        if (isMounted) {
          if (rememberedEmail) {
            setIdentifier(rememberedEmail);
            setRememberMe(true);
          }
          setBiometricOptInChecked(Boolean(optIn));
          // Desbloqueio biométrico disponível apenas com hardware + opt-in aceito + sessão em cache
          setBiometricLoginReady(Boolean(deviceReady && optIn && storedToken && storedDriver));
        }
      } catch (err) {
        // Fallback gracioso
      }
    }

    initBiometricsAndSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleBiometricOptIn = async (value: boolean) => {
    if (value) {
      Alert.alert(
        `Ativar ${biometricType}?`,
        `Ao ativar, você autoriza o uso de ${biometricType} para desbloquear sua sessão salva neste aparelho. Deseja continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Ativar',
            onPress: async () => {
              if (LocalAuthModule) {
                const check = await LocalAuthModule.authenticateAsync({
                  promptMessage: `Confirme sua ${biometricType} para autorizar o desbloqueio`,
                  fallbackLabel: 'Usar Senha',
                  cancelLabel: 'Cancelar',
                });
                if (!check.success) return;
              }
              await secureStorage.setBiometricOptIn(true);
              setBiometricOptInChecked(true);
            },
          },
        ]
      );
    } else {
      await secureStorage.setBiometricOptIn(false);
      setBiometricOptInChecked(false);
      setBiometricLoginReady(false);
    }
  };

  const handleBiometricAuth = async () => {
    setErrorMessage('');
    try {
      const storedToken = await secureStorage.getToken({ requireAuthentication: true });
      const storedDriver = await secureStorage.getDriver();
      if (!storedToken || !storedDriver) {
        Alert.alert(
          'Biometria do Dispositivo',
          'Faça login com seu e-mail e senha uma vez para associar este aparelho à sua conta.'
        );
        return;
      }

      if (!LocalAuthModule) {
        Alert.alert('Aviso', 'Autenticação biométrica indisponível.');
        return;
      }

      const result = await LocalAuthModule.authenticateAsync({
        promptMessage: `Autentique com ${biometricType} para entrar no EHR Frota`,
        fallbackLabel: 'Usar Senha',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });

      if (result?.success) {
        setLoading(true);
        try {
          // Desbloqueia sessão existente validando o token JWT
          const profile = await apiClient.getMe();
          if (profile?.driver) {
            unlockSession(profile.driver, profile.vehicle);
          } else {
            throw { status: 401, message: 'Sessão inválida' };
          }
        } catch (sessionError: any) {
          // Token expirado ou credenciais inválidas: exige login tradicional
          if (sessionError?.status === 401 || sessionError?.status === 403 || sessionError?.message?.includes('token')) {
            await secureStorage.removeToken();
            setBiometricLoginReady(false);
            setPassword('');
            Alert.alert(
              'Sessão Expirada',
              'Sua sessão expirou. Por favor, entre com seu e-mail e senha normalmente.'
            );
          } else {
            throw sessionError;
          }
        }
      } else if (result && result.error && result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
        setErrorMessage('Biometria não reconhecida. Tente novamente ou use sua senha.');
      }
    } catch (error: any) {
      const msg = error.message || 'Falha na autenticação biométrica.';
      setErrorMessage(msg);
      Alert.alert('Erro Biometria', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    if (!identifier || !password) {
      const msg = 'Informe o e-mail e a senha.';
      setErrorMessage(msg);
      Alert.alert('Atenção', msg);
      return;
    }

    setLoading(true);
    try {
      await signIn(identifier.trim(), password);

      // "Lembrar de mim" persiste APENAS o e-mail (nunca a senha e NÃO ativa biometria sozinho)
      if (rememberMe) {
        await secureStorage.saveRememberedEmail(identifier.trim());
      } else {
        await secureStorage.removeRememberedEmail();
      }

      // Se o usuário marcou opt-in biométrico explicitamente na tela de login
      if (biometricOptInChecked) {
        await secureStorage.setBiometricOptIn(true);
      }
    } catch (error: any) {
      const msg = error.message || 'Falha ao autenticar.';
      setErrorMessage(msg);
      Alert.alert('Erro no Login', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screenWrapper}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ImageBackground
          source={require('../../assets/login-hero.jpg')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.imageDarkOverlay}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header com Logo e Marca da EHR na parte superior */}
              <View style={styles.brandSection}>
                <View style={styles.logoBadgeContainer}>
                  <Image
                    source={require('../../assets/ehr-logo-official.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.heroTitle}>EHR SOLUTIONS</Text>
                <Text style={styles.heroSubtitle}>Controle de Bocal & Telemetria IoT</Text>
              </View>

              {/* Janela Visual do Caminhão com luzes e estrada */}
              <View style={styles.truckSpacer} />

              {/* Card de Login com Dark Glassmorphism sobre a estrada */}
              <View style={styles.card}>
                <View style={styles.cardGlowPill} />

                {/* E-mail Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabelIcon}>👤</Text>
                    <Text style={styles.inputLabel}>E-mail</Text>
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.textInput}
                      value={identifier}
                      onChangeText={setIdentifier}
                      placeholder="Digite seu e-mail corporativo"
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                {/* Senha Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabelIcon}>🔒</Text>
                    <Text style={styles.inputLabel}>Senha</Text>
                  </View>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Digite sua senha"
                      placeholderTextColor="#64748B"
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.togglePasswordBtn}
                    >
                      <Text style={styles.togglePasswordIcon}>
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Lembrar de mim Switch (apenas salva o e-mail) */}
                <View style={styles.rememberRow}>
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: '#1E293B', true: '#00D4FF' }}
                    thumbColor={rememberMe ? '#FFFFFF' : '#94A3B8'}
                  />
                  <Text style={styles.rememberText}>Lembrar de mim</Text>
                </View>

                {/* Opt-in explícito para biometria */}
                {biometricAvailable && (
                  <View style={styles.biometricOptInRow}>
                    <Switch
                      value={biometricOptInChecked}
                      onValueChange={handleToggleBiometricOptIn}
                      trackColor={{ false: '#1E293B', true: '#22C55E' }}
                      thumbColor={biometricOptInChecked ? '#FFFFFF' : '#94A3B8'}
                    />
                    <Text style={styles.biometricOptInText}>
                      Desbloqueio com {biometricType}
                    </Text>
                  </View>
                )}

                {/* Botão de Entrar Normal */}
                <Button
                  title={loading ? 'Autenticando...' : 'Entrar'}
                  variant="primary"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.loginBtn}
                />

                {/* Acesso Biométrico Nativo (Face ID / Impressão Digital) */}
                {biometricLoginReady && (
                  <View style={styles.biometricSection}>
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OU DESBLOQUEIO RÁPIDO</Text>
                      <View style={styles.dividerLine} />
                    </View>
                    <TouchableOpacity
                      style={styles.biometricBtn}
                      onPress={handleBiometricAuth}
                      disabled={loading}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Entrar com ${biometricType}`}
                    >
                      <Text style={styles.biometricIcon}>
                        {biometricType === 'Face ID' ? '📱' : '👆'}
                      </Text>
                      <Text style={styles.biometricBtnText}>
                        Entrar com {biometricType}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!biometricLoginReady && biometricAvailable && (
                  <Text style={styles.biometricHint}>
                    Ative o acesso biométrico para desbloquear sua sessão com {biometricType} nos próximos acessos.
                  </Text>
                )}

                {/* Footer Corporativo */}
                <View style={styles.footerInfo}>
                  <Text style={styles.footerText}>EHR Solutions • Gestão de Abastecimento</Text>
                  {__DEV__ && (
                    <Text style={styles.devEnvironmentTag}>API: {getBaseUrl()}</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </ImageBackground>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#050A14',
  },
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  imageDarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.72)',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 24,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 8,
  },
  logoBadgeContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 212, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2.5,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D4FF',
    letterSpacing: 1.2,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  truckSpacer: {
    height: 30,
  },
  card: {
    backgroundColor: 'rgba(11, 22, 40, 0.88)',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },
  cardGlowPill: {
    position: 'absolute',
    top: 0,
    left: '35%',
    right: '35%',
    height: 3,
    backgroundColor: '#00D4FF',
    borderRadius: 2,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabelIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#060B13',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  togglePasswordBtn: {
    padding: 8,
  },
  togglePasswordIcon: {
    fontSize: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  rememberText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 10,
  },
  biometricOptInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  biometricOptInText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 10,
  },
  loginBtn: {
    marginTop: 6,
    marginBottom: 4,
  },
  biometricSection: {
    marginTop: 14,
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: 10,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: '#00D4FF',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    width: '100%',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  biometricIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  biometricBtnText: {
    color: '#00D4FF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  biometricHint: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 15,
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 12,
  },
  footerText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  devEnvironmentTag: {
    color: '#334155',
    fontSize: 9,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
