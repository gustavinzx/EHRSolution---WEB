exports.enroll = async (driverId, imageBuffer) => {
  return { templateRef: 'mock_template_' + driverId };
};

exports.verify = async (driverId, templateRef, imageBuffer) => {
  const content = imageBuffer.toString('utf8') || '';
  if (content.includes('NOMATCH')) {
    return { match: false, score: 0.20, livenessPassed: true };
  } else if (content.includes('NOLIVE')) {
    return { match: true, score: 0.98, livenessPassed: false };
  } else if (content.includes('MATCH')) {
    return { match: true, score: 0.98, livenessPassed: true };
  }
  return { match: false, score: 0.20, livenessPassed: true };
};

exports.remove = async (templateRef) => {
  return true;
};
