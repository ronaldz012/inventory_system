import { ReceptionStatus } from './stock-reception-list-dto';

/**
 * Mínimo de costo unitario para CONFIRMAR una recepción (espejo del
 * `StockReceptionItem.MinUnitCost` del backend). Los borradores lo permiten
 * en 0: no siempre se sabe el precio del proveedor al armar el pedido.
 */
export const MIN_UNIT_COST = 0.5;

export interface StockReceptionDetailDto {
  id: GUID;
  number: number;
  branchId: GUID;
  providerId: GUID;
  providerName: string;
  receivedAt: string;
  notes?: string;
  status: ReceptionStatus;
  totalCost: number;
  items: StockReceptionItemDetailDto[];
}

export interface StockReceptionItemDetailDto {
  id: GUID;
  productVariantId: GUID;
  productId: GUID;
  sku: string;
  productName: string;
  brandName: string;
  variantDescription: string;
  size: string;
  sizeId: GUID;
  /** Orden de talla: mantiene el sort del editor de ítems al re-agregar. */
  sizeOrder: number;
  color: string;
  colorId: GUID;
  /** Precio de venta de la variante: alimenta el resumen Ventas/Ganancia. */
  price: number;
  quantityReceived: number;
  unitCost: number;
  subtotal: number;
}
