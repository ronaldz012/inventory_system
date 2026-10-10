// transfer-item.interface.ts
export interface TransferItem {
  variantId: GUID;
  productId: GUID;
  sku: string;
  productName: string;
  brandName: string;
  variantLabel: string; // "Talle 40 · Negro"
  size: string;
  colorName: string;
  quantity: number;
  maxQuantity: number;
}
