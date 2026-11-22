type GUID = string;
import { SalePaymentLineDto } from './sale-detail-dto';

export interface CreateReturnItemDto {
  originalSaleItemId: GUID;
  quantity: number;
}

export interface CreateReturnDto {
  items: CreateReturnItemDto[];
  /**
   * Una línea por método (tender), montos positivos. La suma debe cerrar
   * exacta contra el monto a devolver: `Σ (unitPrice − discountAmount) × qty`.
   */
  payments: SalePaymentLineDto[];
}

export interface CreateReturnResponse {
  returnSaleId: GUID;
  returnNumber: string;
  totalRefundAmount: number;
}
