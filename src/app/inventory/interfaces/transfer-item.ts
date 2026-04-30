// transfer-item.interface.ts
export interface TransferItem {
  variantId: number;
  sku: string;
  productName: string;
  variantLabel: string; // "Talle 40 · Negro"
  quantity: number;
  maxQuantity: number;
}
