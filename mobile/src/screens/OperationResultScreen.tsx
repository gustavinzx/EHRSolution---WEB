import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OperationContext } from '../contexts/OperationContext';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'OperationResult'>;

export const OperationResultScreen: React.FC<Props> = ({ navigation }) => {
  const { currentOperation } = useContext(OperationContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Operação Finalizada!</Text>

      <View style={styles.card}>
        <Text style={styles.text}>ID Operação: {currentOperation?.id}</Text>
        <Text style={styles.text}>Nível Inicial: {currentOperation?.fuelLevelBefore}%</Text>
        <Text style={styles.text}>Nível Final: {currentOperation?.fuelLevelAfter}%</Text>

        <View style={styles.row}>
          <Text style={styles.text}>Status da Sincronização: </Text>
          <StatusBadge
            label={currentOperation?.status || ''}
            type={currentOperation?.status === 'SYNCED' ? 'success' : 'warning'}
          />
        </View>
      </View>

      <Button title="Voltar ao Dashboard" onPress={() => navigation.replace('Dashboard')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.success,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xl,
  },
  text: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
});