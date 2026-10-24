type GUID = string;
import { PaymentMethod } from '@features/sales/dtos/sale-detail-dto';

export interface SkuSearchQuery {
  sku?: string;
  days?: number;
  page?: number;
  pageSize?: number;
}

export interface MatchedItemDto {
  saleItemId: GUID;
  quantity: number;
  unitPrice: number;
}

export interface SaleSkuSearchDto {
  id: GUID;
  createdAt: string;
  totalAmount: number;
  soldByName: string;
  totalItems: number;
  totalUnitsSold: number;
  matchedItem: MatchedItemDto;
}

export interface SkuSearchResponseDto {
  searchedSku: string;
  searchedDisplayName: string;
  sales: {
    items: SaleSkuSearchDto[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

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
