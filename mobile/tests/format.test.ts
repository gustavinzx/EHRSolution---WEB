import { formatLiters, formatBRL, formatPricePerLiter } from '../src/utils/format';

describe('format utilities (pt-BR)', () => {
  describe('formatLiters', () => {
    it('inteiros: formata sem casas decimais com sufixo " L"', () => {
      expect(formatLiters(500)).toBe('500 L');
      expect(formatLiters(10)).toBe('10 L');
    });

    it('fracionados: formata com vírgula e sufixo " L"', () => {
      expect(formatLiters(500.5)).toBe('500,5 L');
      expect(formatLiters(123.45)).toBe('123,45 L');
    });

    it('zero: formata como "0 L"', () => {
      expect(formatLiters(0)).toBe('0 L');
      expect(formatLiters(0.0)).toBe('0 L');
    });

    it('milhar: formata com ponto separador de milhar', () => {
      expect(formatLiters(1000)).toBe('1.000 L');
      expect(formatLiters(5000)).toBe('5.000 L');
      expect(formatLiters(12500)).toBe('12.500 L');
      expect(formatLiters(5000.75)).toBe('5.000,75 L');
    });

    it('negativos: preserva o sinal negativo', () => {
      expect(formatLiters(-50)).toBe('-50 L');
      expect(formatLiters(-500.5)).toBe('-500,5 L');
      expect(formatLiters(-5000)).toBe('-5.000 L');
    });

    it('valores inválidos: retorna "—" para null, undefined, NaN e valores não-numéricos', () => {
      expect(formatLiters(null)).toBe('—');
      expect(formatLiters(undefined)).toBe('—');
      expect(formatLiters(NaN)).toBe('—');
      expect(formatLiters('invalido')).toBe('—');
    });
  });

  describe('formatBRL', () => {
    it('formata valor monetário com 2 casas decimais e "R$ "', () => {
      expect(formatBRL(6.05)).toBe('R$ 6,05');
      expect(formatBRL(10.5)).toBe('R$ 10,50');
      expect(formatBRL(100)).toBe('R$ 100,00');
    });

    it('zero: formata como "R$ 0,00"', () => {
      expect(formatBRL(0)).toBe('R$ 0,00');
    });

    it('milhar: formata 5000 => "R$ 5.000,00" e valores maiores', () => {
      expect(formatBRL(5000)).toBe('R$ 5.000,00');
      expect(formatBRL(12345.67)).toBe('R$ 12.345,67');
      expect(formatBRL(1000000)).toBe('R$ 1.000.000,00');
    });

    it('negativos: inclui sinal negativo antes do prefixo monetário', () => {
      expect(formatBRL(-6.05)).toBe('-R$ 6,05');
      expect(formatBRL(-5000)).toBe('-R$ 5.000,00');
    });

    it('valores inválidos: retorna "—" para null, undefined, NaN e valores não-numéricos', () => {
      expect(formatBRL(null)).toBe('—');
      expect(formatBRL(undefined)).toBe('—');
      expect(formatBRL(NaN)).toBe('—');
      expect(formatBRL('xyz')).toBe('—');
    });
  });

  describe('formatPricePerLiter', () => {
    it('formata preço unitário por litro com sufixo "/L"', () => {
      expect(formatPricePerLiter(6.05)).toBe('R$ 6,05/L');
      expect(formatPricePerLiter(5.99)).toBe('R$ 5,99/L');
    });

    it('zero: formata como "R$ 0,00/L"', () => {
      expect(formatPricePerLiter(0)).toBe('R$ 0,00/L');
    });

    it('milhar: formata com separador de milhar', () => {
      expect(formatPricePerLiter(5000)).toBe('R$ 5.000,00/L');
    });

    it('negativos: formata com sinal negativo', () => {
      expect(formatPricePerLiter(-6.05)).toBe('-R$ 6,05/L');
    });

    it('valores inválidos: retorna "—" para null, undefined, NaN e valores não-numéricos', () => {
      expect(formatPricePerLiter(null)).toBe('—');
      expect(formatPricePerLiter(undefined)).toBe('—');
      expect(formatPricePerLiter(NaN)).toBe('—');
      expect(formatPricePerLiter('invalido')).toBe('—');
    });
  });
});
