function checkConfig() {
  if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    const err = new Error('Rekognition not configured');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
}

exports.enroll = async (driverId, imageBuffer) => {
  checkConfig();
  return { templateRef: 'aws_' + driverId + '_' + Date.now() };
};

exports.verify = async (driverId, templateRef, imageBuffer) => {
  checkConfig();
  return { match: false, score: 0, livenessPassed: false };
};

exports.remove = async (templateRef) => {
  checkConfig();
  return true;
};
