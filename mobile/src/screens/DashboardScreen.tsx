import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { driver, vehicle, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleStartOperation = async (releaseMethod: 'facial' | 'ble_fallback' = 'facial') => {
    if (!vehicle) return;
    setLoading(true);
    try {
      const session = await apiClient.requestSession(vehicle.id, releaseMethod);
      navigation.navigate('FacialAuth', { sessionId: session.id, status: session.status, releaseMethod: session.release_method });
    } catch (error: any) {
      if (error.status === 409 && error.session) {
        navigation.navigate('FacialAuth', { 
          sessionId: error.session.id, 
          status: error.session.status, 
          releaseMethod: error.session.release_method 
        });
        setLoading(false);
        return;
      }

      let msg = error.message;
      if (error.status === 403) msg = 'Caminhão não vinculado a você.';
      if (error.status === 404) msg = 'Caminhão não encontrado.';
      
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Motorista</Text>
          <Text style={styles.infoName}>{driver?.name}</Text>
          <Text style={styles.infoSub}>E-mail: {driver?.email}</Text>
          <Text style={styles.infoSub}>Telefone: {driver?.phone}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Veículo Vinculado</Text>
          {vehicle ? (
            <>
              <Text style={styles.infoName}>{vehicle.model}</Text>
              <Text style={styles.infoSub}>Placa: {vehicle.plate}</Text>
              <Text style={styles.infoSub}>Marca: {vehicle.brand || '-'}</Text>
              <Text style={styles.infoSub}>Capacidade: {vehicle.capacity}L</Text>
            </>
          ) : (
            <Text style={styles.infoSub}>Nenhum veículo vinculado.</Text>
          )}
        </View>

        <Button
          title={loading ? "AGUARDE..." : "INICIAR ABASTECIMENTO"}
          variant="success"
          onPress={() => handleStartOperation('facial')}
          style={styles.mainBtn}
          disabled={loading || !vehicle}
        />

        <Button 
          title="Usar Bluetooth" 
          variant="secondary" 
          onPress={() => handleStartOperation('ble_fallback')} 
          style={{ marginTop: 10, marginBottom: 20 }}
          disabled={loading || !vehicle}
        />

        <Button title="Sair do Aplicativo" variant="danger" onPress={signOut} disabled={loading} />
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
  mainBtn: {
    marginTop: theme.spacing.md,
    height: 60,
  },
});