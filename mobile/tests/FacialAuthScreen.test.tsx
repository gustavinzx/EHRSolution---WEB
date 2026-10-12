import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { FacialAuthScreen } from '../src/screens/FacialAuthScreen';
import { apiClient } from '../src/services/api/apiClient';
import * as ImageManipulator from 'expo-image-manipulator';

let mockAutoCameraReady = true;

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
    CameraView: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: jest.fn().mockResolvedValue({ uri: 'file:///photo.jpg' })
      }));
      React.useEffect(() => {
        if (mockAutoCameraReady && props.onCameraReady) {
          props.onCameraReady();
        }
      }, [props]);
      return null;
    })
  };
});

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockImplementation(async () => ({
    uri: 'file:///manipulated.jpg',
    base64: 'pure_manipulated_base64_string',
  })),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

import { Alert } from 'react-native';

jest.mock('../src/services/api/apiClient', () => ({
  apiClient: {
    verifyFace: jest.fn(),
    reportFacialFailure: jest.fn(),
    cancelSession: jest.fn(),
    getSession: jest.fn(),
  }
}));

const mockNavigation = { replace: jest.fn(), popToTop: jest.fn() } as any;

describe('FacialAuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoCameraReady = true;
  });

  it('button is disabled before camera is ready', () => {
    mockAutoCameraReady = false;

    const { getByTestId } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    const btn = getByTestId('capture-btn');
    expect(btn.props.accessibilityState?.disabled || btn.props.disabled).toBe(true);
  });

  it('resizes image to 720px, compresses jpeg and sends pure base64', async () => {
    (apiClient.verifyFace as jest.Mock).mockResolvedValue({ verified: true });

    const { getByTestId } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    await waitFor(() => {
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file:///photo.jpg',
        [{ resize: { width: 720 } }],
        { compress: 0.6, format: 'jpeg', base64: true }
      );
      expect(apiClient.verifyFace).toHaveBeenCalledWith(1, 'pure_manipulated_base64_string');
      expect(mockNavigation.replace).toHaveBeenCalledWith('OperationResult', expect.objectContaining({
        sessionId: 1, initialState: 'AUTHORIZING'
      }));
    });
  });

  it('rejects image that exceeds 2MB decoded limit', async () => {
    // Generate large base64 (> 2.8 million chars representing > 2MB decoded)
    const largeBase64 = 'A'.repeat(3000000);
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValueOnce({
      uri: 'file:///large.jpg',
      base64: largeBase64,
    });

    const { getByTestId, findByText } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    const errorMsg = await findByText('Imagem muito grande. Tente capturar novamente.');
    expect(errorMsg).toBeTruthy();
    expect(apiClient.verifyFace).not.toHaveBeenCalled();
  });

  it('handles verified:false and fallback when attempts_left is missing', async () => {
    (apiClient.verifyFace as jest.Mock).mockResolvedValue({ verified: false, attempts: 1 });

    const { getByTestId, findByText } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    const errorMsg = await findByText('Rosto não reconhecido. Tente novamente.');
    expect(errorMsg).toBeTruthy();
  });

  it('handles 429 by session: reports facial failure and navigates to BLOCKED_NEEDS_MANAGER', async () => {
    (apiClient.verifyFace as jest.Mock).mockRejectedValue({
      status: 429,
      message: 'Limite de tentativas da sessão atingido.'
    });
    (apiClient.reportFacialFailure as jest.Mock).mockResolvedValue({ success: true });

    const { getByTestId } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    await waitFor(() => {
      expect(apiClient.reportFacialFailure).toHaveBeenCalledWith(1);
      expect(mockNavigation.replace).toHaveBeenCalledWith('OperationResult', expect.objectContaining({
        sessionId: 1,
        initialState: 'BLOCKED_NEEDS_MANAGER'
      }));
    });
  });

  it('handles 429 by hour: shows message and disables retry without calling reportFacialFailure', async () => {
    (apiClient.verifyFace as jest.Mock).mockRejectedValue({
      status: 429,
      message: 'Limite de tentativas por hora atingido.'
    });

    const { getByTestId, findByText } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    const errorMsg = await findByText('Muitas tentativas. Tente mais tarde.');
    expect(errorMsg).toBeTruthy();
    expect(apiClient.reportFacialFailure).not.toHaveBeenCalled();

    const btn = getByTestId('capture-btn');
    expect(btn.props.accessibilityState?.disabled || btn.props.disabled).toBe(true);
  });

  it('handles network error (status 0)', async () => {
    (apiClient.verifyFace as jest.Mock).mockRejectedValue({
      status: 0,
      message: 'Sem conexão com o servidor.'
    });

    const { getByTestId, findByText } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    const errorMsg = await findByText('Sem conexão. Verifique sua rede e tente novamente.');
    expect(errorMsg).toBeTruthy();
  });

  it('handles 400 image error', async () => {
    (apiClient.verifyFace as jest.Mock).mockRejectedValue({
      status: 400,
      message: 'Formato inválido'
    });

    const { getByTestId, findByText } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    const errorMsg = await findByText('Erro na imagem capturada. Tente novamente.');
    expect(errorMsg).toBeTruthy();
  });

  it('handles 409 face_not_enrolled and disables retry', async () => {
    (apiClient.verifyFace as jest.Mock).mockRejectedValue({ status: 409, code: 'face_not_enrolled' });

    const { getByTestId, findByText } = render(
      <FacialAuthScreen 
        navigation={mockNavigation} 
        route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
      />
    );

    fireEvent.press(getByTestId('capture-btn'));

    const errorMsg = await findByText('Seu rosto não está cadastrado. Procure o gestor.');
    expect(errorMsg).toBeTruthy();

    const btn = getByTestId('capture-btn');
    expect(btn.props.accessibilityState?.disabled || btn.props.disabled).toBe(true);
  });

  describe('Cancellation Flow in FacialAuthScreen (C2)', () => {
    it('cancel button is visible in FACIAL_PENDING, shows confirmation alert on press', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByTestId } = render(
        <FacialAuthScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
        />
      );

      const cancelBtn = getByTestId('cancel-btn');
      expect(cancelBtn).toBeTruthy();

      fireEvent.press(cancelBtn);
      expect(alertSpy).toHaveBeenCalledWith(
        'Cancelar abastecimento',
        'Deseja realmente cancelar o abastecimento?',
        expect.any(Array)
      );
    });

    it('cancels successfully and navigates back to Dashboard', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockResolvedValueOnce({ success: true, status: 'cancelled' });

      const { getByTestId } = render(
        <FacialAuthScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(apiClient.cancelSession).toHaveBeenCalledWith(1);
        expect(mockNavigation.popToTop).toHaveBeenCalled();
      });
    });

    it('handles 409 Sessão em andamento não pode ser cancelada by alerting and transitioning to FUELING', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 409,
        message: 'Sessão em andamento não pode ser cancelada',
      });

      const { getByTestId } = render(
        <FacialAuthScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Aviso', 'O abastecimento já começou e não pode ser cancelado.');
        expect(mockNavigation.replace).toHaveBeenCalledWith(
          'OperationResult',
          expect.objectContaining({ sessionId: 1, initialState: 'FUELING' })
        );
      });
    });

    it('handles 404 Sessão não encontrada by returning to Dashboard', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 404,
        message: 'Sessão não encontrada',
      });

      const { getByTestId } = render(
        <FacialAuthScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(mockNavigation.popToTop).toHaveBeenCalled();
      });
    });

    it('handles network error showing alert and allows repeating', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 0,
        message: 'Sem conexão com o servidor.',
      });

      const { getByTestId } = render(
        <FacialAuthScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Erro', 'Sem conexão. Verifique sua rede e tente novamente.');
      });
      expect(getByTestId('cancel-btn')).toBeTruthy();
    });

    it('handles 500 server error showing generic alert and allows repeating', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (apiClient.cancelSession as jest.Mock).mockRejectedValueOnce({
        status: 500,
        message: 'Internal Server Error',
      });

      const { getByTestId } = render(
        <FacialAuthScreen 
          navigation={mockNavigation} 
          route={{ params: { sessionId: 1, status: 'requested', releaseMethod: 'facial' } } as any} 
        />
      );

      fireEvent.press(getByTestId('cancel-btn'));
      const confirmAction = (alertSpy.mock.calls[0]![2] as any[])[1];
      await act(async () => {
        confirmAction.onPress();
      });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Erro', 'Não foi possível cancelar o abastecimento. Tente novamente.');
      });
      expect(getByTestId('cancel-btn')).toBeTruthy();
      expect(mockNavigation.popToTop).not.toHaveBeenCalled();
    });
  });
});
