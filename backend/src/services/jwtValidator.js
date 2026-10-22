const FORBIDDEN_SECRETS = [
  'change_this_secret_in_production',
  'test_secret',
  'ehr_secret_mude_em_producao_2024',
];

exports.validateJwtSecret = (secret, env) => {
  if (env !== 'production') return true;
  if (!secret) throw new Error('FATAL ERROR: JWT_SECRET is missing in production');
  if (secret.length < 32) throw new Error('FATAL ERROR: JWT_SECRET must be at least 32 characters in production');
  if (FORBIDDEN_SECRETS.includes(String(secret).trim())) {
    throw new Error('FATAL ERROR: JWT_SECRET cannot be a known default or insecure test value in production');
  }
  return true;
};
