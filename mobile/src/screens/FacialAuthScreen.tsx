import React, { useState, useRef, useEffect, useReducer } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button } from '../components/Button';
import { theme } from '../theme/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { sessionReducer, initialSessionState } from '../session/sessionMachine';

type Props = NativeStackScreenProps<RootStackParamList, 'FacialAuth'>;

export const FacialAuthScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId, status, releaseMethod } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [retryBlocked, setRetryBlocked] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const [state, dispatch] = useReducer(sessionReducer, {
    ...initialSessionState,
    status: status === 'authorized' ? 'WAITING_HARDWARE' : 
            status === 'active' ? 'FUELING' : 
            status === 'requested' && releaseMethod === 'ble_fallback' ? 'AUTHORIZING' : 'FACIAL_PENDING',
    sessionId,
    releaseMethod
  });

  const handleCancelPress = () => {
    Alert.alert(
      'Cancelar abastecimento',
      'Deseja realmente cancelar o abastecimento?',
      [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim, cancelar', style: 'destructive', onPress: executeCancel }
      ]
    );
  };

  const executeCancel = async () => {
    try {
      await apiClient.cancelSession(sessionId);
      dispatch({ type: 'CANCELLED' });
      navigation.popToTop();
    } catch (error: any) {
      const status = error.status;
      const msg = typeof error.message === 'string' ? error.message : '';
      const code = error.code;

      if (status === 409 && (msg.includes('em andamento') || code === 'Sessão em andamento não pode ser cancelada')) {
        Alert.alert('Aviso', 'O abastecimento já começou e não pode ser cancelado.');
        dispatch({ type: 'POLL_ACTIVE' });
      } else if (status === 409 && (msg.includes('já foi processada') || code === 'Sessão já foi processada')) {
        try {
          const cur = await apiClient.getSession(sessionId);
          if (cur.status === 'completed') {
            navigation.replace('OperationResult', { sessionId, initialState: 'DONE', releaseMethod });
          } else if (cur.status === 'active') {
            navigation.replace('OperationResult', { sessionId, initialState: 'FUELING', releaseMethod });
          } else {
            navigation.popToTop();
          }
        } catch {
          navigation.popToTop();
        }
      } else if (status === 404) {
        dispatch({ type: 'CANCELLED' });
        navigation.popToTop();
      } else {
        Alert.alert('Erro', 'Sem conexão. Verifique sua rede e tente novamente.');
      }
    }
  };

  useEffect(() => {
    if (state.status === 'AUTHORIZING' || state.status === 'WAITING_HARDWARE' || state.status === 'FUELING' || state.status === 'BLOCKED_NEEDS_MANAGER') {
      navigation.replace('OperationResult', { sessionId, initialState: state.status, releaseMethod });
    }
  }, [state.status, navigation, sessionId, releaseMethod]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    dispatch({ type: 'FACIAL_VERIFY_START' });

    try {
      const photo = await cameraRef.current.takePictureAsync();

      if (!photo?.uri && !photo?.base64) {
        dispatch({ type: 'FACIAL_VERIFY_FAIL', attempts: state.attempts || 0, attemptsLeft: state.attemptsLeft || 3, error: 'Falha ao capturar imagem.' });
        return;
      }

      let base64ToSend = '';
      if (photo.uri) {
        const manipulated = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 720 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        base64ToSend = manipulated.base64 || '';
      } else if (photo.base64) {
        base64ToSend = photo.base64;
      }

      base64ToSend = base64ToSend.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

      const decodedBytes = (base64ToSend.length * 3) / 4;
      if (decodedBytes > 2 * 1024 * 1024) {
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Imagem muito grande. Tente capturar novamente.' });
        return;
      }

      const res = await apiClient.verifyFace(sessionId, base64ToSend);

      if (res.verified) {
        dispatch({ type: 'FACIAL_VERIFY_SUCCESS' });
      } else {
        const attemptsLeft = res.attempts_left;
        if (attemptsLeft === 0) {
          await apiClient.reportFacialFailure(sessionId).catch(() => {});
          dispatch({ type: 'FACIAL_VERIFY_LOCKED', error: 'Rosto não reconhecido. Tentativas esgotadas.' });
        } else if (typeof attemptsLeft === 'number' && attemptsLeft > 0) {
          dispatch({ 
            type: 'FACIAL_VERIFY_FAIL', 
            attempts: res.attempts || 0, 
            attemptsLeft: attemptsLeft, 
            error: `Rosto não reconhecido. Restam ${attemptsLeft} tentativa(s).` 
          });
        } else {
          dispatch({ 
            type: 'FACIAL_VERIFY_FAIL', 
            attempts: res.attempts || 0, 
            attemptsLeft: 0, 
            error: 'Rosto não reconhecido. Tente novamente.' 
          });
        }
      }
    } catch (error: any) {
      if (error.status === 409 && error.code === 'face_not_enrolled') {
        setRetryBlocked(true);
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Seu rosto não está cadastrado. Procure o gestor.' });
      } else if (error.status === 429) {
        if (typeof error.message === 'string' && error.message.includes('sessão')) {
          await apiClient.reportFacialFailure(sessionId).catch(() => {});
          dispatch({ type: 'FACIAL_VERIFY_LOCKED', error: 'Limite de tentativas da sessão atingido.' });
        } else {
          setRetryBlocked(true);
          dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Muitas tentativas. Tente mais tarde.' });
        }
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
              disabled={!cameraReady || state.status === 'VERIFYING' || retryBlocked}
              style={{ marginTop: 20 }}
            />

            {state.status === 'FACIAL_PENDING' && (
              <Button
                testID="cancel-btn"
                title="Cancelar abastecimento"
                variant="danger"
                onPress={handleCancelPress}
                style={{ marginTop: 10 }}
              />
            )}
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