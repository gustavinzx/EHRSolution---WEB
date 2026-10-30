function checkConfig() {
  if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    const err = new Error('Rekognition not configured');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
}

exports.enroll = async (driverId, imageBuffer) => {
  checkConfig();
  const err = new Error('Rekognition enroll not implemented yet');
  err.code = 'NOT_IMPLEMENTED';
  throw err;
};

exports.verify = async (driverId, templateRef, imageBuffer) => {
  checkConfig();
  const err = new Error('Rekognition verify not implemented yet');
  err.code = 'NOT_IMPLEMENTED';
  throw err;
};

exports.remove = async (templateRef) => {
  checkConfig();
  return true;
};
