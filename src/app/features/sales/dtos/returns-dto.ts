type GUID = string;
import { PaymentMethod } from '@features/sales/models/payment-method';

export interface CreateReturnItemDto {
  originalSaleItemId: GUID;
  quantity: number;
}

export interface CreateReturnDto {
  items: CreateReturnItemDto[];
}

export interface CreateReturnResponse {
  returnSaleId: GUID;
  returnNumber: string;
  totalRefundAmount: number;
}

export interface ReturnableItemDto {
  saleItemId: GUID;
  productDisplayName: string;
  productSku: string;
  quantity: number;
  returnableQuantity: number;
  unitPrice: number;
}

export interface SaleForReturnDto {
  id: GUID;
  createdAt: string;
  totalAmount: number;
  soldByName: string;
  type: number | string;
  /** Heredado de la venta original: el reembolso se reintegra por el mismo método. */
  paymentMethod: PaymentMethod;
  items: ReturnableItemDto[];
}
