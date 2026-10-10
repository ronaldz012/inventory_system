import { DocumentType, PaymentMethod, SaleType } from './sale-detail-dto';

export interface ClosureSaleItemDetailDto {
  productVariantId: GUID;
  productSku: string;
  productDisplayName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discountAmount: number;
  finalPrice: number;
}

export interface ClosureSaleItemDto {
  id: GUID;
  createdAt: string;
  soldByName: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  documentType: DocumentType;
  type: SaleType;
  invoiceNumber: number | null;
  transactionCode: string | null;
  itemsCount: number;
  hasReturn: boolean;
  canReturn: boolean;
  cantReturnReason: string | null;
  items: ClosureSaleItemDetailDto[];
}

export interface ClosureVariantStockDto {
  productVariantId: GUID;
  productSku: string;
  productDisplayName: string;
  currentStock: number;
}

export interface ClosureMovementDto {
  id: GUID;
  createdAt: string;
  amount: number;
  description: string;
  type: string;
}

export interface ClosureDetailDto {
  id: GUID;
  number: number;
  branchId: GUID;
  openedAt: string;
  closedAt: string | null;
  openedByName: string;
  closedByName: string | null;
  openingBalance: number;
  systemSalesAmount: number;
  realCountedAmount: number;
  difference: number;
  totalSales: number;
  cashSales: number;
  qrSales: number;
  totalExpenses: number;
  sales: ClosureSaleItemDto[];
  movements: ClosureMovementDto[];
  variantStocks: ClosureVariantStockDto[];
}
