const { validateJwtSecret } = require('../src/services/jwtValidator');

describe('JWT Validator', () => {
  it('passes in non-production environments', () => {
    expect(validateJwtSecret('short', 'development')).toBe(true);
    expect(validateJwtSecret(undefined, 'test')).toBe(true);
  });

  it('fails in production if missing', () => {
    expect(() => validateJwtSecret(undefined, 'production')).toThrow(/missing/i);
    expect(() => validateJwtSecret('', 'production')).toThrow(/missing/i);
  });

  it('fails in production if too short', () => {
    expect(() => validateJwtSecret('short', 'production')).toThrow(/32 characters/i);
  });

  it('fails in production if default value', () => {
    expect(() => validateJwtSecret('change_this_secret_in_production', 'production')).toThrow(/default/i);
  });

  it('passes in production with valid secret', () => {
    const validSecret = 'this_is_a_very_long_and_secure_secret_string_123456';
    expect(validateJwtSecret(validSecret, 'production')).toBe(true);
  });
});
