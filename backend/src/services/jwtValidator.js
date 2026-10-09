exports.validateJwtSecret = (secret, env) => {
  if (env !== 'production') return true;
  if (!secret) throw new Error('FATAL ERROR: JWT_SECRET is missing in production');
  if (secret.length < 32) throw new Error('FATAL ERROR: JWT_SECRET must be at least 32 characters in production');
  if (secret === 'change_this_secret_in_production') throw new Error('FATAL ERROR: JWT_SECRET cannot be the default .env.example value in production');
  return true;
};
