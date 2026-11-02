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
import { ConnectionStatus } from '../components/ConnectionStatus';
import { getBaseUrl, apiClient } from '../services/api/apiClient';
import { secureStorage } from '../storage/secureStorage';
import { getBiometricLabel, isFacialBiometric } from '../utils/biometricLabel';
import { theme } from '../theme/theme';

const Icon: React.FC<{ name: any; size?: number; color?: string; style?: any }> = (props) => {
  if (process.env.NODE_ENV === 'test') {
    return <Text style={[{ color: props.color, fontSize: props.size }, props.style]}>›</Text>;
  }
  const { Ionicons } = require('@expo/vector-icons');
  return <Ionicons {...props} />;
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
  const [cachedDriver, setCachedDriver] = useState<any>(null);
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);
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
            setBiometricType(getBiometricLabel(supportedTypes, Platform.OS));
          }
        }

        const rememberedEmail = await secureStorage.getRememberedEmail();
        const optIn = await secureStorage.getBiometricOptIn();

        const storedDriver = await secureStorage.getDriver();

        if (isMounted) {
          if (rememberedEmail) {
            setIdentifier(rememberedEmail);
            setRememberMe(true);
          }
          setCachedDriver(storedDriver);
          // Desbloqueio biométrico disponível apenas com hardware + opt-in aceito + sessão em cache
          setBiometricLoginReady(Boolean(deviceReady && optIn && storedDriver));
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

  const handleBiometricAuth = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const storedToken = await secureStorage.getToken({ requireAuthentication: true });
      if (!storedToken) {
        // Usuário cancelou o prompt biométrico: permanece na tela sem erro
        const currentOptIn = await secureStorage.getBiometricOptIn();
        if (!cachedDriver || !currentOptIn) {
          setBiometricLoginReady(false);
        }
        return;
      }

      apiClient.setAuthToken(storedToken);
      try {
        const profile = await apiClient.getMe();
        if (profile?.driver) {
          unlockSession(profile.driver, profile.vehicle, storedToken);
        } else if (cachedDriver) {
          unlockSession(cachedDriver, null, storedToken);
        } else {
          throw { status: 401, message: 'Sessão inválida' };
        }
      } catch (sessionError: any) {
        if (sessionError?.status === 401 || sessionError?.status === 403 || sessionError?.message?.includes('token')) {
          await secureStorage.clearAll();
          apiClient.setAuthToken(null);
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
    } catch (error: any) {
      const msg = error?.message || 'Biometria indisponível neste aparelho. Use e-mail e senha.';
      setErrorMessage(msg);
      Alert.alert('Aviso', withDevBiometricDetails(msg, error));
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
      <ConnectionStatus respectTopInset />
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

                {/* Mensagem de Erro Inline (quando houver) */}
                {errorMessage ? (
                  <View style={styles.errorContainer}>
                    <Icon name="alert-circle-outline" size={16} color={theme.colors.error} style={styles.errorIcon} />
                    <Text style={styles.errorText} numberOfLines={2}>
                      {errorMessage}
                    </Text>
                  </View>
                ) : null}

                {/* E-mail Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Icon name="person-outline" size={14} color={theme.colors.textDarkSecondary} style={styles.inputLabelIcon} />
                    <Text style={styles.inputLabel}>E-mail</Text>
                  </View>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'identifier' && styles.inputContainerFocused,
                      Boolean(errorMessage && !identifier) && styles.inputContainerError,
                    ]}
                  >
                    <TextInput
                      style={styles.textInput}
                      value={identifier}
                      onChangeText={(val) => {
                        setIdentifier(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                      onFocus={() => setFocusedField('identifier')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Digite seu e-mail corporativo"
                      placeholderTextColor={theme.colors.textDarkMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                {/* Senha Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Icon name="lock-closed-outline" size={14} color={theme.colors.textDarkSecondary} style={styles.inputLabelIcon} />
                    <Text style={styles.inputLabel}>Senha</Text>
                  </View>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'password' && styles.inputContainerFocused,
                      Boolean(errorMessage && !password) && styles.inputContainerError,
                    ]}
                  >
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Digite sua senha"
                      placeholderTextColor={theme.colors.textDarkMuted}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.togglePasswordBtn}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      <Icon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={theme.colors.textDarkSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Lembrar de mim Switch (apenas salva o e-mail) */}
                <View style={styles.rememberRow}>
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: theme.colors.surfaceDark, true: theme.colors.accentCyanHover }}
                    thumbColor={rememberMe ? theme.colors.white : theme.colors.textDarkSecondary}
                  />
                  <Text style={styles.rememberText}>Lembrar de mim</Text>
                </View>

                {/* Botão de Entrar Normal */}
                <Button
                  title={loading ? 'Autenticando...' : 'Entrar'}
                  variant="primary"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.loginBtn}
                />

                {/* Acesso Biométrico Nativo */}
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
                      activeOpacity={theme.opacity.pressed}
                      accessibilityRole="button"
                      accessibilityLabel={`Entrar com ${biometricType}`}
                      testID="biometric-login-btn"
                    >
                      <Icon
                        name={isFacialBiometric(biometricType) ? 'scan-outline' : 'finger-print-outline'}
                        size={22}
                        color={theme.colors.accentCyan}
                        style={styles.biometricIcon}
                      />
                      <View style={styles.biometricTextColumn} testID="biometric-text-column">
                        {cachedDriver?.name ? (
                          <>
                            <Text
                              style={styles.biometricBtnText}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              Entrar como {cachedDriver.name}
                            </Text>
                            <Text
                              style={styles.biometricSubText}
                              numberOfLines={1}
                            >
                              Entrar com {biometricType}
                            </Text>
                          </>
                        ) : (
                          <Text
                            style={styles.biometricBtnText}
                            numberOfLines={1}
                          >
                            Entrar com {biometricType}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
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
    backgroundColor: theme.colors.bgDark,
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
    backgroundColor: theme.colors.overlayDark,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 48 : 28,
    paddingBottom: theme.spacing.lg,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? theme.spacing.sm : theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  logoBadgeContainer: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.accentCyanSubtle,
    borderWidth: 1.5,
    borderColor: theme.colors.accentCyanBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm + 2,
    ...theme.shadows.glowCyan,
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  heroTitle: {
    fontSize: theme.typography.fontSize.xl,
    lineHeight: theme.typography.lineHeight.xl,
    fontWeight: theme.typography.fontWeight.black,
    color: theme.colors.textDarkPrimary,
    letterSpacing: 2.5,
  },
  heroSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    lineHeight: theme.typography.lineHeight.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.accentCyan,
    letterSpacing: 1.2,
    marginTop: theme.spacing.xs,
    textTransform: 'uppercase',
  },
  truckSpacer: {
    height: 12,
  },
  card: {
    backgroundColor: theme.colors.cardDarkTranslucent,
    borderRadius: theme.borderRadius.card,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md + 4,
    borderWidth: 1,
    borderColor: theme.colors.borderDarkSubtle,
    ...theme.shadows.card,
  },
  cardGlowPill: {
    position: 'absolute',
    top: 0,
    left: '35%',
    right: '35%',
    height: 3,
    backgroundColor: theme.colors.accentCyan,
    borderRadius: theme.borderRadius.pill,
    ...theme.shadows.glowCyan,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorSubtle,
    borderWidth: 1,
    borderColor: theme.colors.errorBorder,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm + 2,
  },
  errorIcon: {
    marginRight: 6,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    flex: 1,
  },
  inputGroup: {
    marginBottom: theme.spacing.sm + 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs + 2,
  },
  inputLabelIcon: {
    marginRight: 6,
  },
  inputLabel: {
    color: theme.colors.textDarkSecondary,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceDarkInput,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDark,
    paddingHorizontal: theme.spacing.md,
    height: 52,
    minHeight: theme.touchTarget.minHeight,
  },
  inputContainerFocused: {
    borderColor: theme.colors.borderDarkFocus,
    backgroundColor: theme.colors.surfaceDark,
  },
  inputContainerError: {
    borderColor: theme.colors.borderDarkError,
  },
  textInput: {
    color: theme.colors.textDarkPrimary,
    fontSize: theme.typography.fontSize.md - 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    flex: 1,
  },
  togglePasswordBtn: {
    padding: theme.spacing.sm,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  rememberText: {
    color: theme.colors.textDarkSecondary,
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.typography.fontWeight.medium,
    marginLeft: theme.spacing.sm + 2,
  },
  loginBtn: {
    marginTop: theme.spacing.xs + 2,
    marginBottom: theme.spacing.xs,
  },
  biometricSection: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.overlayLightDivider,
  },
  dividerText: {
    color: theme.colors.textDarkMuted,
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 1,
    marginHorizontal: theme.spacing.sm + 2,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentCyanSubtle,
    borderWidth: 1.5,
    borderColor: theme.colors.accentCyanHover,
    borderRadius: theme.borderRadius.pill,
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.lg,
    width: '100%',
    ...theme.shadows.button,
  },
  biometricIcon: {
    marginRight: 10,
  },
  biometricTextColumn: {
    flex: 1,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricBtnText: {
    color: theme.colors.accentCyan,
    fontSize: theme.typography.fontSize.md - 1,
    fontWeight: theme.typography.fontWeight.extraBold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  biometricSubText: {
    color: theme.colors.textDarkSecondary,
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.typography.fontWeight.medium,
    marginTop: 2,
    textAlign: 'center',
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: theme.spacing.md + 2,
    borderTopWidth: 1,
    borderTopColor: theme.colors.overlayLightSubtle,
    paddingTop: theme.spacing.sm + 4,
  },
  footerText: {
    color: theme.colors.textDarkMuted,
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.typography.fontWeight.medium,
  },
  devEnvironmentTag: {
    color: theme.colors.textDarkMuted,
    fontSize: 10,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
