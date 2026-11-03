/**
 * Utilitários de formatação para padrões brasileiros (pt-BR).
 * Implementação segura e independente de suporte completo de Intl do Hermes.
 */

function parseValidNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
    return null;
  }
  return num;
}

function formatIntegerWithThousands(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formata volumes em litros: "500 L" (inteiros sem decimais) ou "500,5 L" (fracionados com vírgula).
 * Valores inválidos retornam "—".
 */
export function formatLiters(value: unknown): string {
  const num = parseValidNumber(value);
  if (num === null) return '—';

  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  if (Number.isInteger(absNum)) {
    return `${sign}${formatIntegerWithThousands(absNum.toString())} L`;
  }

  const parts = absNum.toString().split('.');
  const intPart = formatIntegerWithThousands(parts[0]);
  const decPart = parts[1] || '';
  return `${sign}${intPart},${decPart} L`;
}

/**
 * Formata valores monetários em Real: "R$ 6,05", "R$ 5.000,00".
 * Valores inválidos retornam "—".
 */
export function formatBRL(value: unknown): string {
  const num = parseValidNumber(value);
  if (num === null) return '—';

  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  return `${sign}R$ ${formatIntegerWithThousands(intPart)},${decPart}`;
}

/**
 * Formata preço unitário por litro em Real: "R$ 6,05/L", "R$ 5.000,00/L".
 * Valores inválidos retornam "—".
 */
export function formatPricePerLiter(value: unknown): string {
  const num = parseValidNumber(value);
  if (num === null) return '—';

  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);
  const fixed = absNum.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  return `${sign}R$ ${formatIntegerWithThousands(intPart)},${decPart}/L`;
}
