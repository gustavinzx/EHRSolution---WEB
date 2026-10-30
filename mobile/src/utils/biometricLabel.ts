/**
 * Retorna o rótulo amigável da biometria de acordo com o sistema operacional e os tipos suportados.
 *
 * Regras:
 * - iOS:
 *     tipo 2 (facial) => "Face ID"
 *     senão tipo 1 (digital) => "Touch ID"
 *     senão => "Biometria"
 * - Android / Outros:
 *     tipo 1 (digital) => "Digital"
 *     senão tipo 2 (facial) => "Reconhecimento facial"
 *     senão => "Biometria"
 *
 * Se o aparelho Android suportar ambos os tipos [1, 2] ou [2, 1], o rótulo é "Digital".
 */
export function getBiometricLabel(supportedTypes: number[], os: string): string {
  const types = Array.isArray(supportedTypes) ? supportedTypes : [];
  const normalizedOs = (os || '').toLowerCase();

  if (normalizedOs === 'ios') {
    if (types.includes(2)) return 'Face ID';
    if (types.includes(1)) return 'Touch ID';
    return 'Biometria';
  }

  // Android e outras plataformas
  if (types.includes(1)) return 'Digital';
  if (types.includes(2)) return 'Reconhecimento facial';
  return 'Biometria';
}

/**
 * Retorna o ícone representativo do tipo de biometria.
 * Facial => 📱
 * Demais (Digital, Biometria, etc.) => 👆
 */
export function getBiometricIcon(biometricLabel: string): string {
  return isFacialBiometric(biometricLabel) ? '📱' : '👆';
}

export function isFacialBiometric(biometricLabel: string): boolean {
  return biometricLabel === 'Face ID' || biometricLabel === 'Reconhecimento facial';
}
