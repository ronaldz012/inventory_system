import { SaleType, PaymentMethod, DocumentType } from './sale-detail-dto';

export interface SaleListDto {
  id: GUID;
  number: number;
  createdAt: string;
  totalAmount: number;
  soldByName: string;
  firstItemDisplayName: string;
  totalQuantity: number;
  totalDistinctItems: number;
  type: SaleType;
  originalSaleId: GUID | null;
  paymentMethod: PaymentMethod;
  documentType: DocumentType;
  invoiceNumber: number | null;
  transactionCode: string | null;
  hasReturn: boolean;
  returnedAmount: number;
}
