import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { Button } from '../components/Button';
import { facialService } from '../services/biometric/facialService';
import { useConnection } from '../hooks/useConnection';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FacialAuth'>;

type AuthState =
  | 'AGUARDANDO'
  | 'CAPTURANDO'
  | 'VALIDANDO'
  | 'SUCESSO'
  | 'FALHA';

export const FacialAuthScreen: React.FC<Props> = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [authState, setAuthState] = useState<AuthState>('AGUARDANDO');
  const { isOnline } = useConnection();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleCapture = async () => {
    setAuthState('CAPTURANDO');
    setTimeout(async () => {
      setAuthState('VALIDANDO');
      try {
        const isValid = await facialService.processAndValidate('mock_photo_uri', isOnline);
        if (isValid) {
          setAuthState('SUCESSO');
          setTimeout(() => {
            navigation.replace('FuelOperation');
          }, 1000);
        } else {
          setAuthState('FALHA');
        }
      } catch {
        setAuthState('FALHA');
      }
    }, 1200);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text>Sem acesso à câmera. Permita o uso para validar biometria.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.instructions}>Posicione seu rosto na área indicada</Text>

      <View style={styles.cameraWrapper}>
        <CameraView style={styles.camera} facing="front" />
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>Status: {authState}</Text>
        {authState === 'VALIDANDO' && <Text style={styles.subStatus}>Validando identidade...</Text>}
        {authState === 'SUCESSO' && <Text style={styles.successText}>Identidade confirmada!</Text>}
        {authState === 'FALHA' && (
          <Text style={styles.errorText}>Não foi possível validar sua identidade.</Text>
        )}
      </View>

      {authState !== 'VALIDANDO' && authState !== 'SUCESSO' && (
        <Button
          title={authState === 'FALHA' ? 'Tentar Novamente' : 'Capturar e Validar'}
          onPress={handleCapture}
          style={styles.btn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructions: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  cameraWrapper: {
    width: 260,
    height: 260,
    borderRadius: 130,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: theme.colors.secondary,
  },
  camera: {
    flex: 1,
  },
  statusBox: {
    marginVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  statusText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  subStatus: {
    color: theme.colors.warning,
    marginTop: 4,
  },
  successText: {
    color: theme.colors.success,
    marginTop: 4,
    fontWeight: theme.typography.fontWeight.bold,
  },
  errorText: {
    color: theme.colors.error,
    marginTop: 4,
  },
  btn: {
    width: '100%',
  },
});