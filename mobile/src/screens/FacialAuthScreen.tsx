import React, { useState, useRef, useEffect, useReducer } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button } from '../components/Button';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { sessionReducer, initialSessionState } from '../session/sessionMachine';
import { getCancelErrorMessage } from '../utils/cancelError';

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
        Alert.alert('Erro', getCancelErrorMessage(error));
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
      } else {
        base64ToSend = photo.base64 || '';
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
        <Text style={{ color: '#0F172A', textAlign: 'center', marginBottom: 20 }}>Precisamos de acesso à sua câmera.</Text>
        <Button title="Permitir Câmera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.popToTop()}
        >
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.headerTitle}>Validação Facial</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelHeaderBtn}
          onPress={handleCancelPress}
        >
          <Text style={styles.cancelHeaderText}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Camera Viewfinder */}
        <View style={styles.viewfinderCard}>
          <View style={styles.cameraFrame}>
            <CameraView 
              style={styles.camera} 
              facing="front" 
              ref={cameraRef}
              onCameraReady={() => setCameraReady(true)}
            />

            {/* Corner Brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {state.status === 'VERIFYING' && (
              <View style={styles.overlay}>
                <View style={styles.verifyingBadge}>
                  <Text style={styles.overlayText}>Validando Identidade...</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.instructionText}>
          Posicione seu rosto dentro do quadro
        </Text>

        {state.error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        ) : null}

        {/* Buttons */}
        <View style={styles.btnSection}>
          <Button
            testID="capture-btn"
            title={state.status === 'VERIFYING' ? "VERIFICANDO..." : "Capturar Foto"}
            variant="primary"
            onPress={handleCapture}
            disabled={!cameraReady || state.status === 'VERIFYING' || retryBlocked}
            style={styles.captureBtn}
          />

          <TouchableOpacity 
            testID="cancel-btn"
            onPress={handleCancelPress} 
            style={styles.cancelLink}
          >
            <Text style={styles.cancelLinkText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backArrow: {
    fontSize: 26,
    fontWeight: '300',
    color: '#0F172A',
    lineHeight: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  cancelHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  cancelHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  viewfinderCard: {
    width: 280,
    height: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  cameraFrame: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#00C4D0',
  },
  cornerTL: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(7, 13, 24, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyingBadge: {
    backgroundColor: '#0F172A',
    borderColor: '#00C4D0',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  overlayText: {
    color: '#00C4D0',
    fontSize: 14,
    fontWeight: '700',
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginVertical: 8,
    width: '100%',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  btnSection: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  captureBtn: {
    width: '100%',
  },
  cancelLink: {
    marginTop: 12,
    padding: 8,
  },
  cancelLinkText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});