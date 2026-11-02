#!/usr/bin/env node
/*
 * scripts/teste-completo.js - Teste ponta a ponta do EHR Solutions, via API.
 *
 * Faz o papel do painel, do app do motorista E da placa (hardware), sem digitar comando por comando.
 *
 * VARIAVEIS DE AMBIENTE:
 *   E2E_BASE_URL         URL base do backend (padrao: http://localhost:3001)
 *   E2E_ADMIN_EMAIL      E-mail de um usuario ADMIN (obrigatoria)
 *   E2E_ADMIN_PASSWORD   Senha desse usuario ADMIN (obrigatoria)
 *   E2E_DRIVER_PASSWORD  Senha temporaria para o motorista de teste (opcional; gerada aleatoriamente se ausente)
 *   E2E_AUDITOR_PASSWORD Senha temporaria para o auditor de teste (opcional; gerada aleatoriamente se ausente)
 *   E2E_ALLOW_REMOTE     Defina como "true" para autorizar execucao fora de localhost/127.0.0.1
 *
 * OPCOES:
 *   --keep               Nao apaga os dados de teste no final
 *
 * REQUISITOS: Node 18+ (usa fetch nativo). Backend em modo desenvolvimento com
 *   FACE_PROVIDER=mock e FACE_MOCK_MODE=always_match, e VIRTUAL_HARDWARE_ENABLED=false.
 *
 * O QUE ELE CRIA: 2 caminhoes, 1 motorista e 1 usuario auditor com nomes "E2E-...".
 * No final, ele desativa/exclui esses dados (a menos que use --keep).
 */

const crypto = require('crypto');

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');

const rawBaseUrl = (process.env.E2E_BASE_URL || 'http://localhost:3001').trim().replace(/\/+$/, '');

let parsedUrl;
try {
  parsedUrl = new URL(rawBaseUrl);
} catch (_) {
  console.error(`URL invalida em E2E_BASE_URL: "${rawBaseUrl}"`);
  process.exit(1);
}

const isLocalhost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
if (!isLocalhost && process.env.E2E_ALLOW_REMOTE !== 'true') {
  console.error(
    `RECUSADO: E2E_BASE_URL aponta para host remoto (${parsedUrl.hostname}). ` +
      'Por seguranca, o teste E2E so roda contra localhost/127.0.0.1, a menos que E2E_ALLOW_REMOTE=true seja definido explicitamente.'
  );
  process.exit(1);
}

const REQUIRED_ENV = ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key] || !String(process.env[key]).trim());
if (missingEnv.length > 0) {
  console.error(`Variaveis de ambiente obrigatorias ausentes: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const BASE = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;
const ADMIN_EMAIL = String(process.env.E2E_ADMIN_EMAIL).trim();
const ADMIN_PASSWORD = String(process.env.E2E_ADMIN_PASSWORD);

// PNG valido de 1x1 pixel (o provedor "mock" aceita qualquer imagem valida)
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const run = crypto.randomBytes(4).toString('hex').slice(0, 5).toUpperCase();
const PLATE_1 = `E2E${run.slice(0, 4)}`.slice(0, 7);
const PLATE_2 = `E2F${run.slice(0, 4)}`.slice(0, 7);
const DRIVER_EMAIL = `e2e.motorista.${run.toLowerCase()}@example.test`;
const DRIVER_PASS = process.env.E2E_DRIVER_PASSWORD || `${crypto.randomBytes(12).toString('base64url')}A2!`;
const AUDITOR_EMAIL = `e2e.auditor.${run.toLowerCase()}@example.test`;
const AUDITOR_PASS = process.env.E2E_AUDITOR_PASSWORD || `${crypto.randomBytes(12).toString('base64url')}B3!`;
const INVALID_HW_KEY = `invalid_${crypto.randomBytes(8).toString('hex')}`;
const WRONG_LOGIN_PASS = `wrong_${crypto.randomBytes(8).toString('hex')}`;

const results = [];
let tokenAdmin = null;
const created = { truck1: null, truck2: null, driver: null, auditor: null };

async function call(method, path, { token, key, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['x-api-key'] = key;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = text;
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: -1, data: String(err && err.message) };
  }
}

function check(name, ok, detail) {
  results.push({ name, ok });
  const mark = ok ? '[PASSOU]' : '[FALHOU]';
  const color = ok ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${mark}\x1b[0m ${name}`);
  if (!ok && detail !== undefined) {
    const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
    console.log(`         detalhe: ${d.slice(0, 300)}`);
  }
  return ok;
}

const section = (t) => console.log(`\n\x1b[36m== ${t} ==\x1b[0m`);
const asList = (d) => (Array.isArray(d) ? d : (d && (d.items || d.data || d.alerts || d.trucks || d.drivers || d.users)) || []);

// Uma sessao de abastecimento completa ate a autorizacao (motorista) - devolve o id
async function abrirSessaoAutorizada(driverToken, truckId, titulo) {
  const s = await call('POST', '/fueling/sessions', { token: driverToken, body: { truck_id: truckId, release_method: 'facial' } });
  if (!check(`${titulo}: motorista inicia a sessao`, s.status === 201 && s.data && s.data.id, s)) return null;
  const id = s.data.id;
  const v = await call('POST', `/fueling/sessions/${id}/verify-face`, { token: driverToken, body: { image_base64: PNG_1X1 } });
  if (!check(`${titulo}: validacao facial (mock) aprova`, v.status === 200 && v.data && v.data.verified === true, v)) return null;
  const a = await call('POST', `/fueling/sessions/${id}/authorize`, { token: driverToken, body: {} });
  if (!check(`${titulo}: sessao autorizada`, a.status === 200 && a.data && a.data.status === 'authorized', a)) return null;
  return id;
}

async function placaConcluiAbastecimento(key, truckId, sessionId, litrosBomba, titulo) {
  const act = await call('GET', `/fueling/sessions/${truckId}/active`, { key });
  check(`${titulo}: placa recebe unlock=true da sessao ${sessionId}`, act.status === 200 && act.data && act.data.unlock === true && Number(act.data.session_id) === Number(sessionId), act);
  const fin = await call('POST', `/fueling/sessions/${sessionId}/finish`, { key, body: { level_before: 120, level_after: 180 } });
  check(`${titulo}: placa encerra o abastecimento`, fin.status === 200, fin);
  const pump = await call('POST', `/fueling/sessions/${sessionId}/pump-reading`, { key, body: { pump_liters: litrosBomba } });
  check(`${titulo}: placa envia leitura da bomba (${litrosBomba} L)`, pump.status === 200, pump);
}

async function statusDoCaminhao(truckId) {
  const r = await call('GET', '/fleet', { token: tokenAdmin });
  const t = asList(r.data).find((x) => Number(x.id) === Number(truckId));
  return t ? t.status : undefined;
}

async function principal() {
  console.log(`\nTeste completo - API: ${BASE}  (rodada ${run})`);

  section('0. Preparacao');
  const health = await call('GET', '/health');
  if (!check('Backend responde em /health', health.status === 200, health)) {
    console.log('\nO backend nao respondeu. Suba o backend e tente de novo.');
    return;
  }
  const login = await call('POST', '/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (!check('Login do gestor (admin)', login.status === 200 && login.data && login.data.token, login)) return;
  tokenAdmin = login.data.token;

  const t1 = await call('POST', '/fleet', { token: tokenAdmin, body: { plate: PLATE_1, model: 'Scania R450', capacity_liters: 500, tank_capacity_liters: 500 } });
  if (!check(`Cadastrar caminhao ${PLATE_1}`, t1.status === 201 && t1.data && t1.data.id, t1)) return;
  created.truck1 = t1.data.id;
  const t2 = await call('POST', '/fleet', { token: tokenAdmin, body: { plate: PLATE_2, model: 'Volvo FH', capacity_liters: 500, tank_capacity_liters: 500 } });
  if (!check(`Cadastrar segundo caminhao ${PLATE_2}`, t2.status === 201 && t2.data && t2.data.id, t2)) return;
  created.truck2 = t2.data.id;

  const k1 = await call('POST', `/fleet/${created.truck1}/hardware-key`, { token: tokenAdmin });
  const KEY1 = k1.data && (k1.data.api_key || k1.data.key);
  if (!check('Gerar chave de hardware do caminhao 1 (aparece uma vez)', k1.status < 300 && KEY1, k1)) return;
  const k2 = await call('POST', `/fleet/${created.truck2}/hardware-key`, { token: tokenAdmin });
  const KEY2 = k2.data && (k2.data.api_key || k2.data.key);
  check('Gerar chave de hardware do caminhao 2', k2.status < 300 && KEY2, k2);

  const d = await call('POST', '/drivers', {
    token: tokenAdmin,
    body: { name: `E2E Motorista ${run}`, email: DRIVER_EMAIL, password: DRIVER_PASS, truck_id: created.truck1, auto_enroll_face: true },
  });
  if (!check('Cadastrar motorista de teste (rosto cadastrado em modo dev)', d.status === 201 && d.data && d.data.id, d)) {
    console.log('         dica: o backend precisa estar em desenvolvimento com FACE_PROVIDER=mock');
    return;
  }
  created.driver = d.data.id;

  const dl = await call('POST', '/auth/driver/login', { body: { email: DRIVER_EMAIL, password: DRIVER_PASS } });
  if (!check('Login do motorista no app', dl.status === 200 && dl.data && dl.data.token, dl)) return;
  const TOKEN_D = dl.data.token;

  section('1. Abastecimento normal (painel + app + placa)');
  const antes = await call('GET', `/fueling/sessions/${created.truck1}/active`, { key: KEY1 });
  check('Placa consulta antes da sessao: trava continua fechada (unlock=false)', antes.status === 200 && antes.data && antes.data.unlock === false, antes);

  const S1 = await abrirSessaoAutorizada(TOKEN_D, created.truck1, 'Sessao 1');
  if (S1) {
    await placaConcluiAbastecimento(KEY1, created.truck1, S1, 60, 'Sessao 1');
    const res = await call('GET', `/fueling/sessions/${S1}`, { token: TOKEN_D });
    check('App mostra a sessao 1 como concluida', res.status === 200 && res.data && res.data.status === 'completed', res);
    const txt = JSON.stringify(res.data || {}).toLowerCase();
    check('App NAO recebe sinais antifraude (divergencia, nivel do tanque, alerta)', !/diverg|tank|level_before|level_after|alert/.test(txt), txt.slice(0, 200));
    const h = await call('GET', '/fueling/history', { token: TOKEN_D });
    const hi = asList(h.data && (h.data.items || h.data.history || h.data));
    check('Historico do app lista a sessao 1 (60 L, concluida)', h.status === 200 && hi.some((i) => i.status === 'completed' && Number(i.volume_liters) === 60), h);
  }

  section('2. Divergencia bomba x tanque (antifraude)');
  const S2 = await abrirSessaoAutorizada(TOKEN_D, created.truck1, 'Sessao 2');
  if (S2) {
    await placaConcluiAbastecimento(KEY1, created.truck1, S2, 90, 'Sessao 2');
    const al = await call('GET', '/alerts', { token: tokenAdmin });
    const lista = asList(al.data);
    const diverg = lista.find((a) => Number(a.truck_id) === Number(created.truck1) && /diverg/i.test(`${a.type} ${a.message}`));
    check('Painel recebe alerta de divergencia (bomba 90 L x tanque 60 L)', !!diverg, al.status === 200 ? lista.slice(0, 3) : al);
  }

  section('3. Violacao da trava e etiqueta "Alerta de seguranca"');
  const ev = await call('POST', `/fleet/${created.truck1}/security-events`, { key: KEY1, body: { type: 'tamper', severity: 'critical' } });
  check('Placa envia evento de violacao (tamper)', ev.status === 201 || ev.status === 200, ev);
  check('Caminhao fica em "security_alert"', (await statusDoCaminhao(created.truck1)) === 'security_alert');

  const S3 = await abrirSessaoAutorizada(TOKEN_D, created.truck1, 'Sessao 3 (com violacao aberta)');
  if (S3) {
    await placaConcluiAbastecimento(KEY1, created.truck1, S3, 60, 'Sessao 3');
    check('Terminar um abastecimento NAO apaga o alerta de seguranca aberto', (await statusDoCaminhao(created.truck1)) === 'security_alert');
  }

  const al2 = await call('GET', '/alerts', { token: tokenAdmin });
  const tamper = asList(al2.data).find((a) => Number(a.truck_id) === Number(created.truck1) && /tamper/i.test(`${a.type}`) && !a.resolved_at);
  check('Alerta de violacao esta aberto no painel', !!tamper, asList(al2.data).slice(0, 3));
  if (tamper) {
    const semNota = await call('PATCH', `/alerts/${tamper.id}/resolve`, { token: tokenAdmin, body: {} });
    check('Resolver sem nota e recusado (400)', semNota.status === 400, semNota);
    const ok = await call('PATCH', `/alerts/${tamper.id}/resolve`, { token: tokenAdmin, body: { resolution_note: 'Teste automatico: violacao simulada.' } });
    check('Gestor resolve o alerta com nota', ok.status === 200, ok);
    check('Ao resolver o ultimo alerta critico, o caminhao volta a "ok"', (await statusDoCaminhao(created.truck1)) === 'ok');
    const de_novo = await call('PATCH', `/alerts/${tamper.id}/resolve`, { token: tokenAdmin, body: { resolution_note: 'segunda tentativa' } });
    check('Alerta resolvido e imutavel (nao resolve de novo)', de_novo.status === 404 || de_novo.status === 409, de_novo);
  }

  section('4. Cancelamento');
  const S4 = await abrirSessaoAutorizada(TOKEN_D, created.truck1, 'Sessao 4');
  if (S4) {
    const c = await call('POST', `/fueling/sessions/${S4}/cancel`, { token: TOKEN_D, body: {} });
    check('Motorista cancela a sessao', c.status === 200, c);
    const act = await call('GET', `/fueling/sessions/${created.truck1}/active`, { key: KEY1 });
    check('Depois de cancelar, a placa recebe unlock=false (trava fechada)', act.status === 200 && act.data && act.data.unlock === false, act);
    const h = await call('GET', '/fueling/history', { token: TOKEN_D });
    const hi = asList(h.data && (h.data.items || h.data.history || h.data));
    const canc = hi.find((i) => i.status === 'cancelled');
    check('Historico do app mostra a sessao cancelada (sem litros)', !!canc && (canc.volume_liters === null || canc.volume_liters === undefined), h);
  }

  section('5. Seguranca e permissoes');
  const falsa = await call('GET', `/fueling/sessions/${created.truck1}/active`, { key: INVALID_HW_KEY });
  check('Chave falsa e recusada (401)', falsa.status === 401, falsa);
  const outro = await call('GET', `/fueling/sessions/${created.truck2}/active`, { key: KEY1 });
  check('Chave do caminhao 1 NAO consulta o caminhao 2 (401/403)', outro.status === 401 || outro.status === 403, outro);
  const outroTel = await call('POST', `/fleet/${created.truck2}/telemetry`, { key: KEY1, body: { fuel_level_liters: 100, lat: -15.79, lng: -47.88, speed_kmh: 0 } });
  check('Chave do caminhao 1 NAO envia telemetria do caminhao 2 (401/403)', outroTel.status === 401 || outroTel.status === 403, outroTel);
  const painelComChave = await call('GET', '/drivers', { key: KEY1 });
  check('Chave de hardware NAO acessa o painel (401/403)', painelComChave.status === 401 || painelComChave.status === 403, painelComChave);
  const semToken = await call('GET', '/fleet');
  check('Painel sem login e recusado (401)', semToken.status === 401, semToken);
  const motoristaNoPainel = await call('GET', '/drivers', { token: TOKEN_D });
  check('Token de motorista NAO acessa o painel (401/403)', motoristaNoPainel.status === 401 || motoristaNoPainel.status === 403, motoristaNoPainel);

  const aud = await call('POST', '/users', { token: tokenAdmin, body: { name: `E2E Auditor ${run}`, email: AUDITOR_EMAIL, password: AUDITOR_PASS, role: 'auditor' } });
  if (check('Criar usuario auditor de teste', aud.status === 201 && aud.data && aud.data.id, aud)) {
    created.auditor = aud.data.id;
    const al = await call('POST', '/auth/login', { body: { email: AUDITOR_EMAIL, password: AUDITOR_PASS } });
    const TOKEN_A = al.data && al.data.token;
    check('Login do auditor', al.status === 200 && !!TOKEN_A, al);
    if (TOKEN_A) {
      const le = await call('GET', '/fleet', { token: TOKEN_A });
      check('Auditor consegue LER a frota', le.status === 200, le);
      const cria = await call('POST', '/fleet', { token: TOKEN_A, body: { plate: 'AUD0001', model: 'x', capacity_liters: 100 } });
      check('Auditor NAO cadastra caminhao (403)', cria.status === 403, cria);
      const resolve = await call('PATCH', '/alerts/999999/resolve', { token: TOKEN_A, body: { resolution_note: 'nao deveria' } });
      check('Auditor NAO resolve alerta (403)', resolve.status === 403, resolve);
      const usersList = await call('GET', '/users', { token: TOKEN_A });
      check('Auditor NAO lista usuarios (403)', usersList.status === 403, usersList);
    }
  }

  section('6. Limite de tentativas de login');
  const emailFalso = `naoexiste-${run.toLowerCase()}@example.test`;
  const codigos = [];
  for (let i = 0; i < 12; i++) {
    const r = await call('POST', '/auth/login', { body: { email: emailFalso, password: WRONG_LOGIN_PASS } });
    codigos.push(r.status);
  }
  check('10 senhas erradas respondem 401 e da 11a em diante bloqueia (429)', codigos.slice(0, 10).every((c) => c === 401) && codigos.slice(10).every((c) => c === 429), codigos.join(' '));

  section('7. Exclusao preserva o historico e libera a placa');
  const del = await call('DELETE', `/drivers/${created.driver}`, { token: tokenAdmin });
  check('Gestor exclui o motorista de teste', del.status === 200 || del.status === 204, del);
  const dl2 = await call('POST', '/auth/driver/login', { body: { email: DRIVER_EMAIL, password: DRIVER_PASS } });
  check('Motorista excluido nao consegue mais entrar', dl2.status === 401 || dl2.status === 403, dl2);
  const delT = await call('DELETE', `/fleet/${created.truck1}`, { token: tokenAdmin });
  check('Gestor exclui o caminhao 1', delT.status === 200 || delT.status === 204, delT);
  const recria = await call('POST', '/fleet', { token: tokenAdmin, body: { plate: PLATE_1, model: 'Scania R450', capacity_liters: 500, tank_capacity_liters: 500 } });
  check('Mesma placa pode ser cadastrada de novo apos excluir', recria.status === 201 && recria.data && recria.data.id, recria);
  if (recria.data && recria.data.id) created.truck1 = recria.data.id; // para a limpeza
  const chaveAntiga = await call('GET', `/fueling/sessions/${created.truck1}/active`, { key: KEY1 });
  check('Chave do caminhao excluido nao vale para o caminhao recriado (401/403)', chaveAntiga.status === 401 || chaveAntiga.status === 403, chaveAntiga);
}

async function limpar() {
  if (KEEP || !tokenAdmin) return;
  section('Limpeza dos dados de teste');
  if (created.truck1) await call('DELETE', `/fleet/${created.truck1}`, { token: tokenAdmin });
  if (created.truck2) await call('DELETE', `/fleet/${created.truck2}`, { token: tokenAdmin });
  if (created.auditor) await call('PATCH', `/users/${created.auditor}`, { token: tokenAdmin, body: { is_active: false } });
  console.log('Dados "E2E-..." removidos/desativados (use --keep para manter).');
}

principal()
  .catch((err) => {
    console.error('\nErro inesperado no teste:', err);
    results.push({ name: 'execucao do teste', ok: false });
  })
  .then(limpar)
  .then(() => {
    const falhas = results.filter((r) => !r.ok);
    console.log(`\n${results.length - falhas.length} de ${results.length} verificacoes passaram.`);
    if (falhas.length === 0) {
      console.log('\x1b[32mRESULTADO: TUDO PASSOU.\x1b[0m');
      process.exit(0);
    } else {
      console.log('\x1b[31mRESULTADO: ' + falhas.length + ' FALHARAM:\x1b[0m');
      falhas.forEach((f) => console.log(' - ' + f.name));
      console.log('\nCopie a saida inteira e envie para analise.');
      process.exit(1);
    }
  });
