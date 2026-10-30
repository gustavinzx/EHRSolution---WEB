const { validateJwtSecret } = require('../src/services/jwtValidator');

describe('JWT Validator (Validação de Segredos Fortes em Produção)', () => {
  it('permite segredos curtos em ambientes de não-produção (dev / test)', () => {
    expect(validateJwtSecret('short', 'development')).toBe(true);
    expect(validateJwtSecret(undefined, 'test')).toBe(true);
  });

  it('lança erro em produção se JWT_SECRET faltar ou for vazio', () => {
    expect(() => validateJwtSecret(undefined, 'production')).toThrow(/missing/i);
    expect(() => validateJwtSecret('', 'production')).toThrow(/missing/i);
  });

  it('lança erro em produção se JWT_SECRET tiver menos de 32 caracteres', () => {
    expect(() => validateJwtSecret('short_secret_under_32_chars', 'production')).toThrow(/32 characters/i);
  });

  it('lança erro em produção para valores conhecidos/inseguros', () => {
    expect(() => validateJwtSecret('change_this_secret_in_production', 'production')).toThrow(/known default|insecure/i);
    expect(() => validateJwtSecret('test_secret', 'production')).toThrow(/missing|32 characters|insecure/i);
    expect(() => validateJwtSecret('ehr_secret_mude_em_producao_2024', 'production')).toThrow(/known default|insecure/i);
  });

  it('aprova segredo forte e seguro com pelo menos 32 caracteres em produção', () => {
    const validSecret = 'esta_e_uma_chave_secreta_super_forte_para_producao_2026_jwt_token_segura';
    expect(validateJwtSecret(validSecret, 'production')).toBe(true);
  });
});
