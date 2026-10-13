const INTERDICTED_SIGAF_VALUES = new Set([
  'interdicao',
  'interdicao parcial',
  'interdicao total',
  'interditado',
  'interditado parcialmente',
  'interditado totalmente'
]);

const REGULAR_SIGAF_VALUES = new Set([
  'desinterdicao',
  'desinterdicao parcial',
  'desinterdicao total',
  'desinterditado',
  'regular'
]);

function normalizeSigafStatus(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isInterdicted(valor) {
  const normalized = normalizeSigafStatus(valor);
  if (normalized === '') {
    return false;
  }
  if (REGULAR_SIGAF_VALUES.has(normalized)) {
    return false;
  }
  if (INTERDICTED_SIGAF_VALUES.has(normalized)) {
    return true;
  }

  console.warn(
    `[ANP-STATUS] Valor de statusSIGAF desconhecido registrado para análise: "${String(valor).trim()}" (normalizado="${normalized}")`
  );
  return false;
}

module.exports = {
  INTERDICTED_SIGAF_VALUES,
  REGULAR_SIGAF_VALUES,
  normalizeSigafStatus,
  isInterdicted
};
