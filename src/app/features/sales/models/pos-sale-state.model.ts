import { PaymentMethod } from '../models/payment-method';

export interface PosCartItem {
  /** null = venta libre (sin producto de catálogo). */
  productVariantId: GUID | null;
  quantity: number;
  productName: string;
  categoryName: string;
  brandName: string;
  sku: string;
  size: string;
  colorName: string;
  /** Stock disponible; null en ítems libres (no descuenta inventario). */
  stock: number | null;
  originalPrice: number;
  sellingPrice: number;
  discountAmount: number;
  /** Venta libre: descripción tipeada, sin SKU ni variante. */
  isFree: boolean;
  description: string | null;
}

export interface PosSaleState {
  paymentMethod: PaymentMethod | null;
  transactionCode: string | null;
  publicName: string | null;
  cashReceived: number;

  items: PosCartItem[];
}
