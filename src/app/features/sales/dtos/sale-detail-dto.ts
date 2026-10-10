export enum SaleType {
  Sale = 0,
  Return = 1,
}

export enum PaymentMethod {
  Cash = 0,
  QrCode = 1,
}

export function paymentMethodLabel(v: PaymentMethod | string | number): string {
  const n = typeof v === 'string' ? (v === 'Cash' ? 0 : v === 'QrCode' ? 1 : NaN) : (v as number);
  return n === PaymentMethod.QrCode ? 'Pago Móvil' : 'Efectivo';
}
export function isCashPayment(v: PaymentMethod | string | number): boolean {
  return paymentMethodLabel(v) === 'Efectivo';
}

export enum DocumentType {
  Ticket = 0,
  Invoice = 1,
  PendingInvoice = 2,
}

export function documentTypeLabel(v: DocumentType | string | number): string {
  const n = typeof v === 'string' ? (v === 'Ticket' ? 0 : v === 'Invoice' ? 1 : v === 'PendingInvoice' ? 2 : NaN) : (v as number);
  if (n === DocumentType.Invoice) return 'Factura';
  if (n === DocumentType.PendingInvoice) return 'Pendiente';
  return 'Boleta';
}

export function isReturnType(v: SaleType | string | number): boolean {
  if (typeof v === 'string') return v === 'Return' || v === '1';
  return (v as number) === SaleType.Return;
}

export interface SaleItemDetailDto {
  id: GUID;
  productVariantId: GUID;
  productSku: string;
  productDisplayName: string;
  unitPrice: number;
  unitCost?: number;
  quantity: number;
  returnedQuantity: number;
  discountAmount: number;
  finalPrice: number;
}

export interface SaleRefundDto {
  id: GUID;
  createdAt: string;
  totalAmount: number;
  returnNumber?: string | null;
}

export interface SaleDetailDto {
  id: GUID;
  number: number;
  branchId: GUID;
  soldById: GUID;
  soldByName: string;
  type: SaleType;
  totalItems: number;
  documentType: DocumentType;
  paymentMethod: PaymentMethod;
  transactionCode: string | null;
  totalAmount: number;
  invoiceNumber: number | null;
  notes: string | null;
  createdAt: string;
  originalSaleId?: GUID | null;
  items: SaleItemDetailDto[];
  returns: SaleRefundDto[];
}
