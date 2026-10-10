import React, { useState, useRef, useEffect, useReducer } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '../components/Button';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { sessionReducer, initialSessionState } from '../session/sessionMachine';
import * as Location from 'expo-location';

type Props = NativeStackScreenProps<RootStackParamList, 'FacialAuth'>;

export const FacialAuthScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId, status, releaseMethod } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [state, dispatch] = useReducer(sessionReducer, {
    ...initialSessionState,
    status: status === 'authorized' ? 'WAITING_HARDWARE' : 
            status === 'active' ? 'FUELING' : 
            status === 'requested' && releaseMethod === 'ble_fallback' ? 'AUTHORIZING' : 'FACIAL_PENDING',
    sessionId,
    releaseMethod
  });

  useEffect(() => {
    // Navigate automatically if already past facial
    if (state.status === 'AUTHORIZING' || state.status === 'WAITING_HARDWARE' || state.status === 'FUELING' || state.status === 'BLOCKED_NEEDS_MANAGER') {
      navigation.replace('OperationResult', { sessionId, initialState: state.status, releaseMethod });
    }
  }, [state.status, navigation, sessionId, releaseMethod]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    dispatch({ type: 'FACIAL_VERIFY_START' });

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });

      if (!photo?.base64) {
        dispatch({ type: 'FACIAL_VERIFY_FAIL', attempts: state.attempts || 0, attemptsLeft: state.attemptsLeft || 3, error: 'Falha ao capturar imagem.' });
        return;
      }

      const res = await apiClient.verifyFace(sessionId, photo.base64);

      if (res.verified) {
        dispatch({ type: 'FACIAL_VERIFY_SUCCESS' });
      } else {
        if (res.attempts_left === 0) {
          await apiClient.reportFacialFailure(sessionId).catch(() => {});
          dispatch({ type: 'FACIAL_VERIFY_LOCKED', error: 'Rosto não reconhecido. Tentativas esgotadas.' });
        } else {
          dispatch({ 
            type: 'FACIAL_VERIFY_FAIL', 
            attempts: res.attempts || 0, 
            attemptsLeft: res.attempts_left || 0, 
            error: `Rosto não reconhecido. Restam ${res.attempts_left} tentativa(s).` 
          });
        }
      }
    } catch (error: any) {
      if (error.status === 409 && error.code === 'face_not_enrolled') {
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Seu rosto não está cadastrado. Procure o gestor.' });
      } else if (error.status === 429) {
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Muitas tentativas. Tente mais tarde.' });
      } else if (error.status === 503) {
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Serviço de reconhecimento indisponível. Tente novamente em instantes.' });
      } else if (error.status === 400) {
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Erro na imagem capturada. Tente novamente.' });
      } else {
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Sem conexão. Verifique sua rede e tente novamente.' });
      }
    }
  };

  if (!permission) return <View style={styles.container} />;
  
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 20 }}>Precisamos de acesso à sua câmera.</Text>
        <Button title="Permitir Câmera" onPress={requestPermission} />
      </View>
    );
  }

  // Prevent retry if user is not enrolled or too many attempts per hour
  const blockRetry = state.error === 'Seu rosto não está cadastrado. Procure o gestor.' || state.error === 'Muitas tentativas. Tente mais tarde.';

  return (
    <View style={styles.container}>
      {state.status === 'FACIAL_PENDING' || state.status === 'VERIFYING' ? (
        <>
          <View style={styles.cameraContainer}>
            <CameraView 
              style={styles.camera} 
              facing="front" 
              ref={cameraRef}
              onCameraReady={() => setCameraReady(true)}
            />
            {state.status === 'VERIFYING' && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>Validando Rosto...</Text>
              </View>
            )}
          </View>
          
          <View style={styles.infoContainer}>
            {state.error ? (
              <Text style={styles.errorText}>{state.error}</Text>
            ) : (
              <Text style={styles.instructionText}>Alinhe seu rosto e confirme a identidade para liberar o abastecimento.</Text>
            )}
            
            <Button
              testID="capture-btn"
              title={state.status === 'VERIFYING' ? "VERIFICANDO..." : "TIRAR FOTO"}
              onPress={handleCapture}
              disabled={state.status === 'VERIFYING' || blockRetry}
              style={{ marginTop: 20 }}
            />
          </View>
        </>
      ) : (
        <View style={styles.infoContainer}>
          <Text style={styles.instructionText}>Redirecionando...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoContainer: {
    padding: 24,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  instructionText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
    errorText: {
    color: theme.colors.error,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
});