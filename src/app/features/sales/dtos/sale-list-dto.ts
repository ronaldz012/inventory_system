import { SaleType, SalePaymentLineDto, DocumentType, SaleReturnStatus } from './sale-detail-dto';

export interface SaleListDto {
  id: GUID;
  number: number;
  createdAt: string;
  totalAmount: number;
  soldById: GUID | null;
  soldByName: string;
  firstItemDisplayName: string;
  totalQuantity: number;
  totalDistinctItems: number;
  type: SaleType;
  originalSaleId: GUID | null;
  /** Nº de la venta original en una devolución. */
  originalSaleNumber: number | null;
  /** Una línea por método (split payments). En devoluciones los montos son negativos. */
  payments: SalePaymentLineDto[];
  documentType: DocumentType;
  invoiceNumber: number | null;
  transactionCode: string | null;
  hasReturn: boolean;
  returnStatus: SaleReturnStatus;
  /** Monto devuelto, siempre positivo (el backend lo expone así). */
  returnedAmount: number;
}
