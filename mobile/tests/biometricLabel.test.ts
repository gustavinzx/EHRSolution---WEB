import { getBiometricLabel, getBiometricIcon, isFacialBiometric } from '../src/utils/biometricLabel';

describe('biometricLabel utility', () => {
  describe('iOS', () => {
    it('(iOS, [2]) => "Face ID"', () => {
      expect(getBiometricLabel([2], 'ios')).toBe('Face ID');
      expect(getBiometricLabel([2], 'iOS')).toBe('Face ID');
    });

    it('(iOS, [1]) => "Touch ID"', () => {
      expect(getBiometricLabel([1], 'ios')).toBe('Touch ID');
      expect(getBiometricLabel([1], 'iOS')).toBe('Touch ID');
    });

    it('(iOS, []) => "Biometria"', () => {
      expect(getBiometricLabel([], 'ios')).toBe('Biometria');
      expect(getBiometricLabel([], 'iOS')).toBe('Biometria');
    });
  });

  describe('Android', () => {
    it('(Android, [1]) => "Digital"', () => {
      expect(getBiometricLabel([1], 'android')).toBe('Digital');
      expect(getBiometricLabel([1], 'Android')).toBe('Digital');
    });

    it('(Android, [2]) => "Reconhecimento facial"', () => {
      expect(getBiometricLabel([2], 'android')).toBe('Reconhecimento facial');
      expect(getBiometricLabel([2], 'Android')).toBe('Reconhecimento facial');
    });

    it('(Android, [1, 2]) => "Digital"', () => {
      expect(getBiometricLabel([1, 2], 'android')).toBe('Digital');
      expect(getBiometricLabel([2, 1], 'android')).toBe('Digital');
      expect(getBiometricLabel([1, 2], 'Android')).toBe('Digital');
    });

    it('(Android, []) => "Biometria"', () => {
      expect(getBiometricLabel([], 'android')).toBe('Biometria');
      expect(getBiometricLabel([], 'Android')).toBe('Biometria');
    });
  });

  describe('getBiometricIcon / isFacialBiometric', () => {
    it('retorna 📱 para reconhecimento facial e 👆 para outros métodos', () => {
      expect(isFacialBiometric('Face ID')).toBe(true);
      expect(isFacialBiometric('Reconhecimento facial')).toBe(true);
      expect(isFacialBiometric('Touch ID')).toBe(false);
      expect(isFacialBiometric('Digital')).toBe(false);
      expect(isFacialBiometric('Biometria')).toBe(false);

      expect(getBiometricIcon('Face ID')).toBe('📱');
      expect(getBiometricIcon('Reconhecimento facial')).toBe('📱');
      expect(getBiometricIcon('Touch ID')).toBe('👆');
      expect(getBiometricIcon('Digital')).toBe('👆');
      expect(getBiometricIcon('Biometria')).toBe('👆');
    });
  });
});
