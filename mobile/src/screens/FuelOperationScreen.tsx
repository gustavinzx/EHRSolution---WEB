import React, { useState, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { OperationContext } from '../contexts/OperationContext';
import { useAuth } from '../hooks/useAuth';
import { useConnection } from '../hooks/useConnection';
import { bleManager } from '../services/bluetooth/bleManager';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FuelOperation'>;

export const FuelOperationScreen: React.FC<Props> = ({ navigation }) => {
  const { currentOperation, updateOperation, finishOperation } = useContext(OperationContext);
  const { vehicle } = useAuth();
  const { isOnline } = useConnection();

  const [fuelBefore, setFuelBefore] = useState('25');
  const [fuelAfter, setFuelAfter] = useState('');
  const [lockStatus, setLockStatus] = useState<'BLOQUEADA' | 'LIBERADA' | 'PROCESSANDO'>(
    'BLOQUEADA'
  );

  const handleUnlock = async () => {
    if (!fuelBefore) {
      Alert.alert('Erro', 'Informe o nível inicial do combustível.');
      return;
    }

    setLockStatus('PROCESSANDO');
    await updateOperation({
      fuelLevelBefore: Number(fuelBefore),
      connectionMode: isOnline ? 'ONLINE' : 'BLE',
      status: 'UNLOCKED',
    });

    const success = await bleManager.unlockLock();
    if (success) {
      setLockStatus('LIBERADA');
    } else {
      setLockStatus('BLOQUEADA');
      Alert.alert('Falha', 'Não foi possível comunicar com a trava via BLE.');
    }
  };

  const handleLockAndFinish = async () => {
    if (!fuelAfter) {
      Alert.alert('Erro', 'Informe o nível final de combustível.');
      return;
    }

    setLockStatus('PROCESSANDO');
    const success = await bleManager.lockLock();

    if (success) {
      setLockStatus('BLOQUEADA');
      await finishOperation(Number(fuelAfter));
      navigation.replace('OperationResult');
    } else {
      Alert.alert('Erro', 'Falha ao bloquear a trava.');
      setLockStatus('LIBERADA');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Veículo: {vehicle?.model}</Text>
        <Text style={styles.label}>Placa: {vehicle?.plate}</Text>
        <Text style={styles.label}>Modo: {isOnline ? 'ONLINE' : 'BLE OFFLINE'}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Estado Trava: </Text>
          <StatusBadge
            label={lockStatus}
            type={lockStatus === 'LIBERADA' ? 'warning' : 'success'}
          />
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Nível de Combustível Antes (%)</Text>
        <TextInput
          style={styles.input}
          value={fuelBefore}
          onChangeText={setFuelBefore}
          keyboardType="numeric"
          editable={lockStatus === 'BLOQUEADA'}
        />

        {lockStatus === 'BLOQUEADA' && (
          <Button
            title="LIBERAR TRAVA"
            variant="secondary"
            onPress={handleUnlock}
          />
        )}

        {lockStatus === 'LIBERADA' && (
          <>
            <Text style={[styles.inputLabel, { marginTop: theme.spacing.md }]}>
              Nível de Combustível Depois (%)
            </Text>
            <TextInput
              style={styles.input}
              value={fuelAfter}
              onChangeText={setFuelAfter}
              keyboardType="numeric"
              placeholder="Digite o nível final"
            />

            <Button
              title="FECHAR TRAVA E FINALIZAR"
              variant="danger"
              onPress={handleLockAndFinish}
            />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textPrimary,
  },
  formCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputLabel: {
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
  },
});