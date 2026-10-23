const bcrypt = require('bcrypt');

describe('bcrypt upgrade compatibility', () => {
  // Hash $2b$ gerado com bcrypt v5.1.1 para a senha abaixo:
  const PLAIN_PASSWORD = 'SenhaCompatibilidade@2026';
  const V5_HASH = '$2b$10$BqWK4QqKIFQ2Udw6UlP4hO1E0RgsKaAB7jbLTj6co6WE2S4qzZdvy';

  test('hash $2b$ gerado na v5 valida com sucesso no compare()', async () => {
    const isValid = await bcrypt.compare(PLAIN_PASSWORD, V5_HASH);
    expect(isValid).toBe(true);

    const isInvalid = await bcrypt.compare('SenhaIncorreta@999', V5_HASH);
    expect(isInvalid).toBe(false);
  });

  test('geração e validação de novo hash continuam funcionando normalmente', async () => {
    const newPass = 'NovaSenhaDeTeste@2026';
    const newHash = await bcrypt.hash(newPass, 10);
    expect(newHash).toMatch(/^\$2[aby]\$\d{2}\$/);

    const isValid = await bcrypt.compare(newPass, newHash);
    expect(isValid).toBe(true);

    const isInvalid = await bcrypt.compare('SenhaErrada@000', newHash);
    expect(isInvalid).toBe(false);
  });
});
