import React, { useState } from 'react';
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
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';

export const LoginScreen: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [pass, setPass] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { signIn } = useAuth();

  const handleLogin = async () => {
    setErrorMessage('');
    if (!identifier || !pass) {
      const msg = 'Informe o e-mail e a senha.';
      setErrorMessage(msg);
      Alert.alert('Atenção', msg);
      return;
    }

    setLoading(true);
    try {
      await signIn(identifier.trim(), pass);
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
              {/* Header com Logo e Marca da EHR na parte superior (área escura do céu) */}
              <View style={styles.brandSection}>
                <Image
                  source={require('../../assets/ehr-logo-official.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.heroTitle}>EHR SOLUTIONS</Text>
                <Text style={styles.heroSubtitle}>Gestão de Abastecimento de Frota</Text>
              </View>

              {/* Janela Visual do Caminhão: espaço flexível permitindo ver o caminhão e suas luzes neon sem corte */}
              <View style={styles.truckSpacer} />

              {/* Card de Login com Dark Glassmorphism sobre a estrada */}
              <View style={styles.card}>
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
                      placeholder="Digite seu e-mail"
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
                      value={pass}
                      onChangeText={setPass}
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

                {/* Lembrar de mim Switch */}
                <View style={styles.rememberRow}>
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: '#334155', true: '#00C4D0' }}
                    thumbColor={rememberMe ? '#FFFFFF' : '#94A3B8'}
                  />
                  <Text style={styles.rememberText}>Lembrar de mim</Text>
                </View>

                {errorMessage ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* Botão Entrar Cyan Pill */}
                <Button
                  title={loading ? "Entrando..." : "Entrar"}
                  variant="primary"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.loginBtn}
                />

                {/* Footer Corporativo */}
                <View style={styles.footerInfo}>
                  <Text style={styles.footerText}>EHR Solutions • Gestão de Abastecimento</Text>
                  {__DEV__ && (
                    <Text style={styles.devEnvironmentTag}>Ambiente de Desenvolvimento Seguro</Text>
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
    backgroundColor: '#030712',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#070D18',
    overflow: 'hidden',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  imageDarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 24, 0.25)',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  brandSection: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  logoImage: {
    width: 68,
    height: 68,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00C4D0',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#E2E8F0',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  truckSpacer: {
    flex: 1,
    minHeight: 140,
  },
  card: {
    backgroundColor: 'rgba(11, 20, 36, 0.92)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 196, 208, 0.3)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inputLabelIcon: {
    fontSize: 13,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#070E1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    height: 50,
  },
  textInput: {
    color: '#FFFFFF',
    fontSize: 14,
    width: '100%',
    padding: 0,
  },
  togglePasswordBtn: {
    padding: 6,
  },
  togglePasswordIcon: {
    fontSize: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  rememberText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  loginBtn: {
    marginTop: 6,
    marginBottom: 10,
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  devEnvironmentTag: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
});