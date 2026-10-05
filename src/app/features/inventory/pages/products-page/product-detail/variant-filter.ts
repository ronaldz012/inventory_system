/**
 * Búsqueda y orden de variantes en el detalle de producto.
 * - Multi-token sin orden ("azul 44" = "44 azul"), insensible a tildes.
 * - El filtro NO reordena: preserva el orden del backend (color → talla).
 * - Sucursales siempre en alfabético (predecible); la activa solo se resalta.
 */

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function tokenize(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

export interface VariantSearchTarget {
  size: string;
  color: string;
  sku: string;
}

export function matchesVariant(query: string, v: VariantSearchTarget): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeText(`${v.size} ${v.color} ${v.sku}`);
  return tokens.every((t) => haystack.includes(t));
}

export function sortBranchIds(ids: string[], names: Record<string, string>): string[] {
  return [...ids].sort((a, b) =>
    (names[a] ?? a).localeCompare(names[b] ?? b, 'es'),
  );
}

/** 'off' = orden del backend (color → talla); 'desc'/'asc' = por stock. */
export type VariantSort = 'off' | 'desc' | 'asc';

/**
 * Ordena por stock sin perder el suborden del backend: el desempate es el
 * índice original, así dos variantes con el mismo stock conservan el orden
 * en que llegaron (color y luego talla).
 */
export function sortVariantsByStock<T>(
  list: T[],
  mode: VariantSort,
  stockOf: (v: T) => number,
): T[] {
  if (mode === 'off') return list;
  const dir = mode === 'desc' ? -1 : 1;
  return list
    .map((v, i) => ({ v, i, stock: stockOf(v) }))
    .sort((a, b) => (a.stock - b.stock) * dir || a.i - b.i)
    .map((x) => x.v);
}

export interface HighlightPart {
  part: string;
  hit: boolean;
}

/** Divide el texto marcando los tokens encontrados (best-effort, sin tildes). */
export function highlightParts(text: string, tokens: string[]): HighlightPart[] {
  const lower = text.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  for (const t of tokens) {
    if (!t) continue;
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(t, from);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + t.length });
      from = idx + t.length;
    }
  }
  if (ranges.length === 0) return [{ part: text, hit: false }];
  ranges.sort((a, b) => a.start - b.start);
  const parts: HighlightPart[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos) continue;
    if (r.start > pos) parts.push({ part: text.slice(pos, r.start), hit: false });
    parts.push({ part: text.slice(r.start, r.end), hit: true });
    pos = r.end;
  }
  if (pos < text.length) parts.push({ part: text.slice(pos), hit: false });
  return parts;
}
