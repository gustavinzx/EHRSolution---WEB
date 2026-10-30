const mockProvider = require('./mockProvider');
const rekognitionProvider = require('./rekognitionProvider');

const disabledProvider = {
  enroll: async () => {
    const err = new Error('Biometria facial não configurada no servidor (FACE_PROVIDER indefinido).');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  },
  verify: async () => {
    const err = new Error('Biometria facial não configurada no servidor (FACE_PROVIDER indefinido).');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  },
  remove: async () => {}
};

const providerName = process.env.FACE_PROVIDER;

if (providerName === 'mock') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error("MOCK FACE PROVIDER IS FORBIDDEN IN PRODUCTION");
  }
  const mode = process.env.FACE_MOCK_MODE || 'marker';
  if (mode !== 'marker' && mode !== 'always_match') {
    throw new Error(`FACE_MOCK_MODE inválido: "${mode}". Valores permitidos: "marker", "always_match".`);
  }
}

let activeProvider = disabledProvider;
if (providerName === 'mock') {
  activeProvider = mockProvider;
} else if (providerName === 'rekognition') {
  activeProvider = rekognitionProvider;
}

module.exports = activeProvider;
