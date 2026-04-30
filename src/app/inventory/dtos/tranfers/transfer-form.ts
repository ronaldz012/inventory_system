export interface TransferForm {
  toBranchId: number | null;
  notes: string;
  items: TransferItemForm[];
}
export interface TransferItemForm {
  productVariantId: number;
  quantityRequested: number;
}
