const mockProvider = require('./mockProvider');
const rekognitionProvider = require('./rekognitionProvider');

const providerName = process.env.FACE_PROVIDER || 'mock';

if (providerName === 'mock' && process.env.NODE_ENV === 'production') {
  throw new Error("MOCK FACE PROVIDER IS FORBIDDEN IN PRODUCTION");
}

module.exports = providerName === 'rekognition' ? rekognitionProvider : mockProvider;
