import React, { useContext } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useConnection } from '../hooks/useConnection';
import { OperationContext } from '../contexts/OperationContext';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { driver, vehicle, signOut } = useAuth();
  const { isOnline } = useConnection();
  const { pendingSyncCount, startNewOperation, synchronizePending } = useContext(OperationContext);

  const handleStartOperation = () => {
    if (driver && vehicle) {
      startNewOperation(driver.id, vehicle.id);
      navigation.navigate('FacialAuth');
    }
  };

  return (
    <View style={styles.container}>
      <ConnectionStatus />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Motorista</Text>
          <Text style={styles.infoName}>{driver?.name}</Text>
          <Text style={styles.infoSub}>Matrícula: {driver?.registration}</Text>
          <Text style={styles.infoSub}>CPF: {driver?.cpf}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Veículo Vinculado</Text>
          <Text style={styles.infoName}>{vehicle?.model}</Text>
          <Text style={styles.infoSub}>Placa: {vehicle?.plate}</Text>
          <Text style={styles.infoSub}>ID BLE: {vehicle?.bleDeviceId}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status do Sistema</Text>
          <View style={styles.badgeRow}>
            <StatusBadge
              label={isOnline ? 'CONEXÃO CLOUD' : 'MODO BLE LOCAL'}
              type={isOnline ? 'success' : 'warning'}
            />
            <StatusBadge label="TRAVA FECHADA" type="info" />
          </View>
          <Text style={styles.syncText}>
            Operações pendentes de sincronização: {pendingSyncCount}
          </Text>

          {isOnline && pendingSyncCount > 0 && (
            <Button title="Sincronizar Agora" variant="secondary" onPress={synchronizePending} />
          )}
        </View>

        <Button
          title="INICIAR ABASTECIMENTO"
          variant="success"
          onPress={handleStartOperation}
          style={styles.mainBtn}
        />

        <Button title="Sair do Aplicativo" variant="danger" onPress={signOut} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    padding: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  infoName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
  infoSub: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginVertical: theme.spacing.xs,
  },
  syncText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  mainBtn: {
    marginTop: theme.spacing.md,
    height: 60,
  },
});