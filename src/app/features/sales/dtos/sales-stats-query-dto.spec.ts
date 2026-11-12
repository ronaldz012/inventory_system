import {
  dayOf,
  defaultStatsQuery,
  parseStatsQuery,
  rangeForDay,
  rangeForLastDays,
  sameStatsQuery,
  serializeStatsQuery,
  todayKey,
  tzOffsetMinutes,
} from './sales-stats-query-dto';

/** Cantidad de días calendario que abarca el rango (inclusive). */
function dayCount(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((+end - +start) / 86_400_000) + 1;
}

describe('sales-stats-query-dto', () => {
  it('el default son los últimos 7 días, terminando hoy a las 23:59', () => {
    const q = defaultStatsQuery();
    const from = new Date(q.dateFrom);
    const to = new Date(q.dateTo);
    const now = new Date();

    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getHours()).toBe(23);
    expect(to.getDate()).toBe(now.getDate());

    expect(dayCount(q.dateFrom, q.dateTo)).toBe(7);
  });

  it('rangeForLastDays arma el rango desde el inicio del primer día', () => {
    const range = rangeForLastDays(30);
    const from = new Date(range.dateFrom);
    const to = new Date(range.dateTo);

    expect(from.getHours()).toBe(0);
    expect(dayCount(range.dateFrom, range.dateTo)).toBe(30);
  });

  it('un día puntual arma un rango de ese día completo', () => {
    const range = rangeForDay('2026-10-05');
    const from = new Date(range.dateFrom);
    const to = new Date(range.dateTo);

    expect(from.getDate()).toBe(5);
    expect(from.getMonth()).toBe(9);
    expect(from.getHours()).toBe(0);
    expect(to.getDate()).toBe(5);
    expect(to.getHours()).toBe(23);
  });

  it('parsea la URL y cae al default si falta el rango', () => {
    expect(parseStatsQuery({})).toEqual(defaultStatsQuery());

    const range = rangeForDay(todayKey());
    expect(parseStatsQuery({ ...range, soldById: 'u1' })).toEqual({ ...range, soldById: 'u1' });

    // Rango inválido → se ignora y vuelve el default.
    expect(parseStatsQuery({ dateFrom: 'no-es-fecha', dateTo: 'tampoco' })).toEqual(
      defaultStatsQuery(),
    );
  });

  it('serializa el rango explícito y omite el vendedor vacío', () => {
    const range = rangeForDay('2026-10-05');

    expect(serializeStatsQuery(range)).toEqual(range);
    expect(serializeStatsQuery({ ...range, soldById: 'u1' }).soldById).toBe('u1');
  });

  it('compara consultas por valor', () => {
    const a = rangeForDay('2026-10-05');
    expect(sameStatsQuery(a, { ...a })).toBe(true);
    expect(sameStatsQuery(a, rangeForDay('2026-10-06'))).toBe(false);
    expect(sameStatsQuery(a, { ...a, soldById: 'u1' })).toBe(false);
  });

  it('dayOf devuelve el día local del instante (para precargar los inputs)', () => {
    expect(dayOf(rangeForDay('2026-03-09').dateFrom)).toBe('2026-03-09');
    expect(dayOf(rangeForDay('2026-03-09').dateTo)).toBe('2026-03-09');
  });

  it('el offset de zona se manda con el signo del backend (UTC−4 → −240)', () => {
    // JS devuelve el signo invertido: se verifica la conversión exacta.
    expect(tzOffsetMinutes()).toBe(-new Date().getTimezoneOffset());
  });
});
