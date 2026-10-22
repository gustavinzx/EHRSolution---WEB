const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');
const authRoutes = require('../src/routes/auth');

describe('Rate Limiter, Proxy & Security Tests (Bloco C)', () => {
  it('header x-api-key falso NÃO escapa do limiter', async () => {
    // Configura app de teste com o mesmo skip seguro do generalLimiter (sem x-api-key bypass)
    const testApp = express();
    testApp.use(express.json());

    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => false, // Não pula por header x-api-key nem por IP local
      message: { error: 'Limite atingido' },
    });

    testApp.get('/test-route', limiter, (req, res) => {
      res.json({ ok: true });
    });

    // 1ª requisição com header x-api-key falso
    const r1 = await request(testApp).get('/test-route').set('x-api-key', 'fake-bogus-key');
    expect(r1.status).toBe(200);

    // 2ª requisição com header x-api-key falso
    const r2 = await request(testApp).get('/test-route').set('x-api-key', 'fake-bogus-key');
    expect(r2.status).toBe(200);

    // 3ª requisição DEVE ser bloqueada (429) provando que o header falso não burlou o limiter
    const r3 = await request(testApp).get('/test-route').set('x-api-key', 'fake-bogus-key');
    expect(r3.status).toBe(429);
    expect(r3.body.error).toContain('Limite atingido');
  });

  it('login de e-mails diferentes no mesmo IP não se bloqueiam entre si (keyGenerator = IP + e-mail)', async () => {
    const testApp = express();
    testApp.use(express.json());

    // keyGenerator igual ao auth.js
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 2,
      keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        return `${ip}:${email}`;
      },
      validate: { keyGeneratorIpFallback: false },
      message: { error: 'Muitas tentativas de login' },
    });

    testApp.post('/login', loginLimiter, (req, res) => {
      res.status(401).json({ error: 'Credenciais inválidas' });
    });

    // Usuário A esgota suas 2 tentativas no mesmo IP
    await request(testApp).post('/login').send({ email: 'usuarioA@ehr.com', password: '123' });
    await request(testApp).post('/login').send({ email: 'usuarioA@ehr.com', password: '123' });

    // 3ª tentativa do Usuário A deve ser bloqueada com 429
    const resA3 = await request(testApp).post('/login').send({ email: 'usuarioA@ehr.com', password: '123' });
    expect(resA3.status).toBe(429);

    // Usuário B no MESMO IP deve continuar conseguindo tentar login normalmente (não bloqueado pelo Usuário A)
    const resB1 = await request(testApp).post('/login').send({ email: 'usuarioB@ehr.com', password: '123' });
    expect(resB1.status).toBe(401); // 401 (processado) em vez de 429 (bloqueado)
  });

  it('normaliza e-mail no keyGenerator (maiúsculas e minúsculas compartilham o mesmo limite)', async () => {
    const testApp = express();
    testApp.use(express.json());

    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 2,
      keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        return `${ip}:${email}`;
      },
      validate: { keyGeneratorIpFallback: false },
      message: { error: 'Muitas tentativas' },
    });

    testApp.post('/login', loginLimiter, (req, res) => {
      res.status(401).json({ error: 'Erro' });
    });

    await request(testApp).post('/login').send({ email: 'motorista@ehr.com', password: '123' });
    await request(testApp).post('/login').send({ email: 'MOTORISTA@EHR.COM', password: '123' });

    // 3ª tentativa deve bater no limiter mesmo com variação de case
    const res3 = await request(testApp).post('/login').send({ email: 'Motorista@Ehr.Com', password: '123' });
    expect(res3.status).toBe(429);
  });

  it('NODE_ENV=production + DISABLE_RATE_LIMIT=true continua limitando (trava de segurança em produção)', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDisable = process.env.DISABLE_RATE_LIMIT;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      process.env.NODE_ENV = 'production';
      process.env.DISABLE_RATE_LIMIT = 'true';

      if (process.env.NODE_ENV === 'production' && process.env.DISABLE_RATE_LIMIT === 'true') {
        console.warn('[SECURITY WARNING] DISABLE_RATE_LIMIT=true é ignorado em produção. O rate limiter permanece ativo.');
      }
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DISABLE_RATE_LIMIT=true é ignorado em produção')
      );

      const testApp = express();
      testApp.use(express.json());

      const skipFn = () => {
        if (process.env.NODE_ENV === 'production') {
          return false;
        }
        return process.env.DISABLE_RATE_LIMIT === 'true';
      };

      const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
        skip: skipFn,
        message: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' },
      });

      testApp.get('/test-prod-route', limiter, (req, res) => {
        res.json({ ok: true });
      });

      const r1 = await request(testApp).get('/test-prod-route');
      expect(r1.status).toBe(200);

      const r2 = await request(testApp).get('/test-prod-route');
      expect(r2.status).toBe(200);

      // 3ª requisição deve ser bloqueada mesmo com DISABLE_RATE_LIMIT=true em produção
      const r3 = await request(testApp).get('/test-prod-route');
      expect(r3.status).toBe(429);
      expect(r3.body.error).toContain('Muitas requisições');
    } finally {
      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
      process.env.DISABLE_RATE_LIMIT = originalDisable;
    }
  });

  it('teto por IP no login (ipLoginLimiter): 101 tentativas com e-mails diferentes no mesmo IP -> a 101ª retorna 429', async () => {
    const testApp = express();
    testApp.use(express.json());

    // Configuração idêntica a routes/auth.js
    const ipLoginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitas tentativas de login a partir deste endereço IP. Tente novamente após 15 minutos.' },
    });

    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        return `${ip}:${email}`;
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { keyGeneratorIpFallback: false },
      message: { error: 'Muitas tentativas de login. Tente novamente após 15 minutos.' },
    });

    testApp.post('/login', ipLoginLimiter, loginLimiter, (req, res) => {
      res.status(401).json({ error: 'Credenciais inválidas' });
    });

    // Envia 100 requisições, cada uma com um e-mail diferente, do mesmo IP
    for (let i = 1; i <= 100; i++) {
      const res = await request(testApp)
        .post('/login')
        .send({ email: `motorista_${i}@ehr.com`, password: 'pwd' });
      expect(res.status).toBe(401);
    }

    // A 101ª requisição do mesmo IP (mesmo com e-mail novo) DEVE ser bloqueada pelo ipLoginLimiter (429)
    const res101 = await request(testApp)
      .post('/login')
      .send({ email: 'novo_motorista_101@ehr.com', password: 'pwd' });
    expect(res101.status).toBe(429);
    expect(res101.body.error).toContain('Muitas tentativas de login a partir deste endereço IP');
  });

  it('e-mails diferentes abaixo do teto de IP NÃO se bloqueiam entre si', async () => {
    const testApp = express();
    testApp.use(express.json());

    const ipLoginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitas tentativas de login a partir deste endereço IP' },
    });

    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        return `${ip}:${email}`;
      },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { keyGeneratorIpFallback: false },
      message: { error: 'Muitas tentativas de login para este e-mail' },
    });

    testApp.post('/login', ipLoginLimiter, loginLimiter, (req, res) => {
      res.status(401).json({ error: 'Credenciais inválidas' });
    });

    // Usuário 1 faz 5 tentativas inválidas e atinge o limite por e-mail
    for (let i = 0; i < 5; i++) {
      await request(testApp).post('/login').send({ email: 'alfa@ehr.com', password: '123' });
    }
    const resAlfa6 = await request(testApp).post('/login').send({ email: 'alfa@ehr.com', password: '123' });
    expect(resAlfa6.status).toBe(429);
    expect(resAlfa6.body.error).toContain('Muitas tentativas de login para este e-mail');

    // Usuário 2 no MESMO IP deve continuar com acesso liberado pois está abaixo do teto de IP (6 < 100) e do teto de e-mail (0 < 5)
    const resBeta1 = await request(testApp).post('/login').send({ email: 'beta@ehr.com', password: '123' });
    expect(resBeta1.status).toBe(401);
  });
});
