import React, { useState, useRef, useEffect, useReducer } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button } from '../components/Button';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../services/api/apiClient';
import { sessionReducer, initialSessionState } from '../session/sessionMachine';
import { getCancelErrorMessage } from '../utils/cancelError';
import { withTimeout, TimeoutError } from '../utils/withTimeout';

type Props = NativeStackScreenProps<RootStackParamList, 'FacialAuth'>;

export const FacialAuthScreen: React.FC<Props> = ({ navigation, route }) => {
  const { sessionId, status, releaseMethod } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [retryBlocked, setRetryBlocked] = useState(false);
  const [capturedPreviewUri, setCapturedPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const isCapturingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    if (isCapturingRef.current) return;
    if (!cameraRef.current) return;

    isCapturingRef.current = true;
    if (isMountedRef.current) {
      setCapturedPreviewUri(null);
      dispatch({ type: 'FACIAL_VERIFY_START' });
    }

    try {
      const t0 = Date.now();
      const photo = await withTimeout(
        cameraRef.current.takePictureAsync(),
        10000,
        'A câmera demorou para responder. Tente novamente.'
      );
      if (__DEV__) {
        console.log(`[FACIAL TIMING] Captura: ${Date.now() - t0}ms`);
      }

      if (!isMountedRef.current) return;

      if (!photo?.uri && !photo?.base64) {
        dispatch({ type: 'FACIAL_VERIFY_FAIL', attempts: state.attempts || 0, attemptsLeft: state.attemptsLeft || 3, error: 'Falha ao capturar imagem.' });
        return;
      }

      if (photo.uri) {
        setCapturedPreviewUri(photo.uri);
      }

      let base64ToSend = '';
      if (photo.uri) {
        const tManipStart = Date.now();
        const manipulated = await withTimeout(
          ImageManipulator.manipulateAsync(
            photo.uri,
            [{ resize: { width: 720 } }],
            { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          ),
          10000,
          'A câmera demorou para responder. Tente novamente.'
        );
        if (__DEV__) {
          console.log(`[FACIAL TIMING] Redimensionamento: ${Date.now() - tManipStart}ms`);
        }
        if (!isMountedRef.current) return;
        if (manipulated.uri) {
          setCapturedPreviewUri(manipulated.uri);
        }
        base64ToSend = manipulated.base64 || '';
      } else {
        base64ToSend = photo.base64 || '';
      }

      base64ToSend = base64ToSend.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      if (!photo.uri && base64ToSend) {
        setCapturedPreviewUri(`data:image/jpeg;base64,${base64ToSend}`);
      }

      const decodedBytes = (base64ToSend.length * 3) / 4;
      if (decodedBytes > 2 * 1024 * 1024) {
        if (isMountedRef.current) {
          setCapturedPreviewUri(null);
          dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Imagem muito grande. Tente capturar novamente.' });
        }
        return;
      }

      const tSendStart = Date.now();
      if (__DEV__) {
        console.log('[FACIAL TIMING] Envio iniciado');
      }
      const res = await apiClient.verifyFace(sessionId, base64ToSend);
      if (__DEV__) {
        console.log(`[FACIAL TIMING] Resposta recebida: ${Date.now() - tSendStart}ms`);
      }

      if (!isMountedRef.current) return;

      if (res.verified) {
        dispatch({ type: 'FACIAL_VERIFY_SUCCESS' });
      } else {
        setCapturedPreviewUri(null);
        const attemptsLeft = res.attempts_left;
        if (attemptsLeft === 0) {
          await apiClient.reportFacialFailure(sessionId).catch(() => {});
          if (isMountedRef.current) {
            dispatch({ type: 'FACIAL_VERIFY_LOCKED', error: 'Rosto não reconhecido. Tentativas esgotadas.' });
          }
        } else if (typeof attemptsLeft === 'number' && attemptsLeft > 0) {
          if (isMountedRef.current) {
            dispatch({ 
              type: 'FACIAL_VERIFY_FAIL', 
              attempts: res.attempts || 0, 
              attemptsLeft: attemptsLeft, 
              error: `Rosto não reconhecido. Restam ${attemptsLeft} tentativa(s).` 
            });
          }
        } else {
          if (isMountedRef.current) {
            dispatch({ 
              type: 'FACIAL_VERIFY_FAIL', 
              attempts: res.attempts || 0, 
              attemptsLeft: 0, 
              error: 'Rosto não reconhecido. Tente novamente.' 
            });
          }
        }
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;
      setCapturedPreviewUri(null);

      if (error instanceof TimeoutError || error?.name === 'TimeoutError') {
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'A câmera demorou para responder. Tente novamente.' });
        return;
      }

      if (error.status === 409 && error.code === 'face_not_enrolled') {
        setRetryBlocked(true);
        dispatch({ type: 'FACIAL_VERIFY_ERROR', error: 'Seu rosto não está cadastrado. Procure o gestor.' });
      } else if (error.status === 429) {
        if (typeof error.message === 'string' && error.message.includes('sessão')) {
          await apiClient.reportFacialFailure(sessionId).catch(() => {});
          if (isMountedRef.current) {
            dispatch({ type: 'FACIAL_VERIFY_LOCKED', error: 'Limite de tentativas da sessão atingido.' });
          }
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
    } finally {
      isCapturingRef.current = false;
    }
  };

  if (!permission) return <View style={styles.container} />;
  
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#FFFFFF', textAlign: 'center', marginBottom: 20 }}>Precisamos de acesso à sua câmera.</Text>
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

            {capturedPreviewUri ? (
              <Image
                testID="captured-photo-preview"
                source={{ uri: capturedPreviewUri }}
                style={styles.capturedPreview}
                resizeMode="cover"
              />
            ) : null}

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
    backgroundColor: '#070D18',
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#070D18',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backArrow: {
    fontSize: 26,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
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
    backgroundColor: '#0F1A2C',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
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
  capturedPreview: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    backgroundColor: 'rgba(7, 13, 24, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyingBadge: {
    backgroundColor: '#0F1A2C',
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
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
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
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});