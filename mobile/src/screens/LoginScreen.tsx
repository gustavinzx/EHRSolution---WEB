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
  Dimensions,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Hero Brand Section with Dusk Truck Reference Background */}
        <View style={styles.heroSection}>
          <ImageBackground
            source={require('../../assets/login-hero.jpg')}
            style={styles.heroBackground}
            resizeMode="cover"
          >
            <View style={styles.heroOverlay}>
              <Image
                source={require('../../assets/ehr-logo-official.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.heroTitle}>EHR SOLUTIONS</Text>
              <Text style={styles.heroSubtitle}>Gestão de Abastecimento de Frota</Text>
            </View>
          </ImageBackground>
        </View>

        {/* Bottom Card Deep Navy Sheet Matching Web Dark Mode */}
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

          {/* Footer Corporativo Seguro (Sem expor URL da API em produção) */}
          <View style={styles.footerInfo}>
            <Text style={styles.footerText}>EHR Solutions • Gestão de Abastecimento</Text>
            {__DEV__ && (
              <Text style={styles.devEnvironmentTag}>Ambiente de Desenvolvimento Seguro</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D18',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  heroSection: {
    width: '100%',
    height: Math.max(SCREEN_HEIGHT * 0.42, 260),
  },
  heroBackground: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 24, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
    paddingHorizontal: 20,
  },
  logoImage: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00C4D0',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#E2E8F0',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  card: {
    backgroundColor: '#0F1A2C',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 196, 208, 0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
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
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    height: 52,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  togglePasswordBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  togglePasswordIcon: {
    fontSize: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 10,
  },
  rememberText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  loginBtn: {
    height: 52,
    borderRadius: 26,
    marginTop: 8,
    backgroundColor: '#00C4D0',
    borderColor: '#00B4C0',
  },
  footerInfo: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  devEnvironmentTag: {
    fontSize: 10,
    color: '#475569',
    marginTop: 4,
    fontWeight: '600',
  },
});