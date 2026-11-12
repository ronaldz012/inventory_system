import { asOptionalString } from '@shared/utils/list-query';

export interface SalesStatsQuery {
  /** Inicio del día local, como instante ISO. */
  dateFrom: string;
  /** Fin del día local, como instante ISO. */
  dateTo: string;
  soldById?: GUID;
}

export interface StatsRange {
  dateFrom: string;
  dateTo: string;
}

/** `YYYY-MM-DD` en hora local (no usar toISOString: en UTC-4 cambia de día de noche). */
export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(now = new Date()): string {
  return dayKey(now);
}

/** Minutos sumados a UTC para bucketear el día local (el backend espera −240 en UTC−4). */
export function tzOffsetMinutes(): number {
  // `getTimezoneOffset()` viene con el signo invertido: UTC−4 → +240.
  return -new Date().getTimezoneOffset();
}

function startOfLocalDay(day: Date): string {
  const local = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  return local.toISOString();
}

function endOfLocalDay(day: Date): string {
  const local = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return local.toISOString();
}

/** Rango de los presets, contando hacia atrás desde hoy (7d = hoy y los 6 anteriores). */
/** Rango de N días que termina hoy (7 = hoy y los 6 anteriores). */
export function rangeForLastDays(days: number, now = new Date()): StatsRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  return { dateFrom: startOfLocalDay(start), dateTo: endOfLocalDay(now) };
}

/** Un día suelto (`YYYY-MM-DD`). */
export function rangeForDay(dayStr: string): StatsRange {
  const [year, month, day] = dayStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return { dateFrom: startOfLocalDay(date), dateTo: endOfLocalDay(date) };
}

/** Al entrar sin parámetros: últimos 7 días (con datos desde el primer segundo). */
export function defaultStatsQuery(now = new Date()): SalesStatsQuery {
  return { ...rangeForLastDays(7, now) };
}

function isIsoDate(value: string | undefined): value is string {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * URL → consulta. Si falta o viene inválido algún extremo, se cae al default
 * (7 días); el contenedor después normaliza la URL para que quede explícita.
 */
export function parseStatsQuery(raw: Record<string, string>): SalesStatsQuery {
  const fallback = defaultStatsQuery();
  const dateFrom = isIsoDate(raw['dateFrom']) ? raw['dateFrom'] : fallback.dateFrom;
  const dateTo = isIsoDate(raw['dateTo']) ? raw['dateTo'] : fallback.dateTo;
  return {
    dateFrom,
    dateTo,
    soldById: asOptionalString(raw['soldById']),
  };
}

export type StatsQueryStrings = {
  dateFrom: string;
  dateTo: string;
  soldById?: string;
};

/** Consulta → params. Siempre explícitos: la URL describe exactamente lo que se ve. */
export function serializeStatsQuery(q: SalesStatsQuery): StatsQueryStrings {
  return {
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    soldById: q.soldById,
  };
}

export function sameStatsQuery(a: SalesStatsQuery, b: SalesStatsQuery): boolean {
  return a.dateFrom === b.dateFrom && a.dateTo === b.dateTo && a.soldById === b.soldById;
}

/** Día local `YYYY-MM-DD` de un instante ISO (para precargar los inputs). */
export function dayOf(iso: string): string {
  return dayKey(new Date(iso));
}
