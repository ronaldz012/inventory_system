import {
  highlightParts,
  matchesVariant,
  normalizeText,
  sortBranchIds,
  sortVariantsByStock,
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

  describe('sortVariantsByStock', () => {
    // Orden del backend: Azul 42, Azul 44, Negro 42, Negro 44
    const list = [
      { sku: 'A42', stock: 5 },
      { sku: 'A44', stock: 9 },
      { sku: 'N42', stock: 9 },
      { sku: 'N44', stock: 1 },
    ];
    const byStock = (v: { stock: number }) => v.stock;
    const skus = (mode: 'off' | 'desc' | 'asc') =>
      sortVariantsByStock(list, mode, byStock).map((v) => v.sku);

    it("'off' devuelve la lista tal cual (orden del backend)", () => {
      expect(skus('off')).toEqual(['A42', 'A44', 'N42', 'N44']);
    });

    it("'desc' ordena mayor a menor", () => {
      expect(skus('desc')).toEqual(['A44', 'N42', 'A42', 'N44']);
    });

    it("'asc' ordena menor a mayor", () => {
      expect(skus('asc')).toEqual(['N44', 'A42', 'A44', 'N42']);
    });

    it('desempata por índice original (preserva color → talla)', () => {
      const same = [
        { sku: 'Azul 42', stock: 7 },
        { sku: 'Azul 44', stock: 7 },
        { sku: 'Negro 42', stock: 7 },
      ];
      expect(sortVariantsByStock(same, 'desc', byStock).map((v) => v.sku)).toEqual([
        'Azul 42',
        'Azul 44',
        'Negro 42',
      ]);
      expect(sortVariantsByStock(same, 'asc', byStock).map((v) => v.sku)).toEqual([
        'Azul 42',
        'Azul 44',
        'Negro 42',
      ]);
    });

    it('no muta el array original', () => {
      const original = [...list];
      sortVariantsByStock(list, 'desc', byStock);
      expect(list).toEqual(original);
    });
  });
});
