import { SaleReturnStatus, SaleType } from './sale-detail-dto';
import { asNumber, asOptionalString } from '@shared/utils/list-query';

export interface SalesQueryDto {
  /** Búsqueda libre: Nº de venta, SKU o nombre de producto. */
  filter?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Pestaña activa. Ventas por defecto; Devoluciones es la vista de auditoría. */
  type: SaleType;
  /** Solo aplica a ventas. `undefined` = sin filtro. */
  returnStatus?: SaleReturnStatus;
  page: number;
  pageSize: number;
}

/** Defaults del listado (se omiten de la URL cuando coinciden). */
export const SALES_QUERY_DEFAULTS = {
  type: SaleType.Sale,
  page: 1,
  pageSize: 10,
} as const;

const RETURN_STATUS_VALUES: readonly SaleReturnStatus[] = [
  SaleReturnStatus.None,
  SaleReturnStatus.Partial,
  SaleReturnStatus.Full,
];

/** El backend parsea el número de venta puro; el `#` es solo de la UI. */
export function cleanSalesFilter(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = value.trim().replace(/^#/, '').trim();
  return cleaned === '' ? undefined : cleaned;
}

function parseReturnStatus(raw: string | undefined): SaleReturnStatus | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return (RETURN_STATUS_VALUES as readonly number[]).includes(n)
    ? (n as SaleReturnStatus)
    : undefined;
}

export function parseSalesQuery(raw: Record<string, string>): SalesQueryDto {
  // `type=1` es Devoluciones; cualquier otro valor cae en Ventas.
  const type = raw['type'] === String(SaleType.Return) ? SaleType.Return : SaleType.Sale;
  return {
    filter: cleanSalesFilter(raw['filter']),
    dateFrom: asOptionalString(raw['dateFrom']),
    dateTo: asOptionalString(raw['dateTo']),
    type,
    // El estado de devolución solo existe en la vista de ventas.
    returnStatus: type === SaleType.Return ? undefined : parseReturnStatus(raw['returnStatus']),
    page: asNumber(raw['page'], SALES_QUERY_DEFAULTS.page),
    pageSize: asNumber(raw['pageSize'], SALES_QUERY_DEFAULTS.pageSize),
  };
}

export type SalesQueryStrings = {
  filter?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: number;
  returnStatus?: number;
  page?: number;
  pageSize?: number;
};

/** Params de la consulta → query string, omitiendo los defaults. */
export function serializeSalesQuery(q: SalesQueryDto): SalesQueryStrings {
  const isReturns = q.type === SaleType.Return;
  return {
    filter: cleanSalesFilter(q.filter),
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    type: isReturns ? SaleType.Return : undefined,
    // En devoluciones no existe "estado de devolución": se descarta.
    returnStatus: isReturns ? undefined : q.returnStatus,
    page: q.page > SALES_QUERY_DEFAULTS.page ? q.page : undefined,
    pageSize: q.pageSize !== SALES_QUERY_DEFAULTS.pageSize ? q.pageSize : undefined,
  };
}

export function sameSalesQuery(a: SalesQueryDto, b: SalesQueryDto): boolean {
  return (
    a.filter === b.filter &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    a.type === b.type &&
    a.returnStatus === b.returnStatus &&
    a.page === b.page &&
    a.pageSize === b.pageSize
  );
}
