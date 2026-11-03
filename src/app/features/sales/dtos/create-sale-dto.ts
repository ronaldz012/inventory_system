import { PaymentMethod } from '@features/sales/models/payment-method';

export interface CreateSaleDto {
  paymentMethod: PaymentMethod;
  invoiceNumber: number | null;
  documentType: number; // 0=Ticket, 1=Invoice, 2=PendingInvoice
  transactionCode: string | null;
  notes: string | null;
  items: CreateSaleItemDto[];
}

export interface CreateSaleItemDto {
  /** Variante de catálogo. Se omite/null en ítems libres. */
  productVariantId?: GUID | null;
  /** Solo ítems libres: descripción tipeada por el vendedor (máx. 120). */
  description?: string | null;
  /** Solo ítems libres: precio base (mín. 0.5). */
  unitPrice?: number | null;
  quantity: number;
  discountAmount: number;
}
