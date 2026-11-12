import { PaymentMethod } from './sale-detail-dto';

/** Respuesta de `GET /api/Sale/stats`. Espejo de `SalesStatsDto` (backend). */
export interface SalesStatsDto {
  totals: SalesStatsTotalsDto;
  byDay: SalesStatsByDayDto[];
  byPaymentMethod: SalesStatsByPaymentMethodDto[];
  bySeller: SalesStatsBySellerDto[];
  topProducts: SalesStatsTopProductDto[];
}

export interface SalesStatsTotalsDto {
  salesCount: number;
  returnsCount: number;
  grossSalesAmount: number;
  returnsAmount: number;
  netSalesAmount: number;
  unitsSold: number;
  unitsReturned: number;
  avgTicket: number;
  discountAmount: number;
  /** Ingresos de ítems libres (sin producto registrado). */
  freeSalesAmount: number;
  freeSalesCount: number;
  /** Unidades vendidas como venta libre. Pendiente en backend: si no llega, no se muestra. */
  freeUnitsSold?: number | null;
  /** Solo llegan si el actor tiene el permiso de margen. */
  grossMargin: number | null;
  marginPct: number | null;
  /** % de los ingresos netos cubiertos por ítems con costo. */
  marginCoveragePct: number | null;
}

export interface SalesStatsByDayDto {
  /** `YYYY-MM-DD` del día local de la sucursal. */
  date: string;
  salesCount: number;
  netSalesAmount: number;
}

export interface SalesStatsByPaymentMethodDto {
  method: PaymentMethod;
  salesCount: number;
  amount: number;
}

export interface SalesStatsBySellerDto {
  id: GUID;
  name: string;
  salesCount: number;
  netSalesAmount: number;
  avgTicket: number;
}

export interface SalesStatsTopProductDto {
  productVariantId: GUID;
  productName: string;
  productSku: string;
  units: number;
  netSalesAmount: number;
  /** null si el actor no ve márgenes o la variante no tiene costo. */
  grossMargin: number | null;
}
