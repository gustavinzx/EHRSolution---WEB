import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { theme } from '../theme/theme';

export const LoginScreen: React.FC = () => {
  const [identifier, setIdentifier] = useState('motorista1@ehr.com');
  const [pass, setPass] = useState('Demo@1234');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!identifier || !pass) {
      Alert.alert('Atenção', 'Informe o CPF/Matrícula e a senha.');
      return;
    }

    setLoading(true);
    try {
      await signIn(identifier, pass);
    } catch (error: any) {
      Alert.alert('Erro no Login', error.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ConnectionStatus />
      <View style={styles.content}>
        <Text style={styles.logoText}>EHR SOLUTIONS</Text>
        <Text style={styles.subtitle}>Gestão de Abastecimento de Frota</Text>

        <View style={styles.form}>
          <Text style={styles.label}>CPF ou Matrícula</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Digite seu documento"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={pass}
            onChangeText={setPass}
            placeholder="Digite sua senha"
            secureTextEntry
          />

          <Button title="Entrar" onPress={handleLogin} loading={loading} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  logoText: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  form: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
  },
});