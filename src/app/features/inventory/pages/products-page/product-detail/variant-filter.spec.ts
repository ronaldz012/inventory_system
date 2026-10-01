import {
  highlightParts,
  matchesVariant,
  normalizeText,
  sortBranchIds,
  tokenize,
} from './variant-filter';

describe('variant-filter', () => {
  it('normalizeText quita tildes y minúsculas', () => {
    expect(normalizeText('Azúl  MARINO')).toBe('azul  marino');
  });

  it('tokenize parte por espacios e ignora vacíos', () => {
    expect(tokenize('  azul   44 ')).toEqual(['azul', '44']);
    expect(tokenize('')).toEqual([]);
  });

  it('matchesVariant: multi-token sin orden', () => {
    const v = { size: '44', color: 'Azul', sku: 'LEV1-038' };
    expect(matchesVariant('azul', v)).toBe(true);
    expect(matchesVariant('44', v)).toBe(true);
    expect(matchesVariant('azul 44', v)).toBe(true);
    expect(matchesVariant('44 azul', v)).toBe(true);
    expect(matchesVariant('azúl', v)).toBe(true);
    expect(matchesVariant('', v)).toBe(true);
  });

  it('matchesVariant: ambigüedad SKU/talla se tolera', () => {
    const v = { size: '38', color: 'Rojo', sku: 'LEV1-038' };
    expect(matchesVariant('38', v)).toBe(true);
  });

  it('matchesVariant: tokens deben cumplirse todos', () => {
    const v = { size: '44', color: 'Azul', sku: 'LEV1-001' };
    expect(matchesVariant('azul 38', v)).toBe(false);
    expect(matchesVariant('verde', v)).toBe(false);
  });

  it('matchesVariant: busca también por SKU', () => {
    const v = { size: '44', color: 'Azul', sku: 'LEV1-001' };
    expect(matchesVariant('lev1', v)).toBe(true);
  });

  it('sortBranchIds: alfabético, estable', () => {
    const names = { b1: 'Zarate', b2: 'Centro', b3: 'Alto' };
    expect(sortBranchIds(['b1', 'b2', 'b3'], names)).toEqual(['b3', 'b2', 'b1']);
  });

  it('highlightParts: marca ocurrencias sin romper el texto', () => {
    const parts = highlightParts('Azul Marino', ['azul']);
    expect(parts).toEqual([
      { part: 'Azul', hit: true },
      { part: ' Marino', hit: false },
    ]);
  });

  it('highlightParts: sin tokens devuelve texto intacto', () => {
    expect(highlightParts('Rojo', [])).toEqual([{ part: 'Rojo', hit: false }]);
  });
});
