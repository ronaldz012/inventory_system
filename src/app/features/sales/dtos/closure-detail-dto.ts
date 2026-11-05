import { DocumentType, PaymentMethod, SaleReturnStatus, SaleType } from './sale-detail-dto';

export interface ClosureSaleItemDetailDto {
  /** null = ítem libre (venta sin producto registrado). */
  productVariantId: GUID | null;
  productSku: string;
  productDisplayName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
  discountAmount: number;
  finalPrice: number;
}

export interface ClosureSaleItemDto {
  id: GUID;
  number: number;
  createdAt: string;
  soldByName: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  documentType: DocumentType;
  type: SaleType;
  /** Vínculo de una devolución con la venta que la originó (null en ventas). */
  originalSaleId: GUID | null;
  originalSaleNumber: number | null;
  invoiceNumber: number | null;
  transactionCode: string | null;
  itemsCount: number;
  hasReturn: boolean;
  /** Estado de devolución de una venta; `None` en documentos de devolución. */
  returnStatus: SaleReturnStatus;
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
  type: 'Outflow' | 'Inflow';
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
