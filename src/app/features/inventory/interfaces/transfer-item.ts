// transfer-item.interface.ts
export interface TransferItem {
  variantId: GUID;
  sku: string;
  productName: string;
  // TODO backend: mapear BrandName explícito. Hoy viene en
  // ProductVariantBySkuDto.BranchName (pv.Product.Brand.Name).
  brandName: string;
  variantLabel: string; // "Talle 40 · Negro"
  size: string;
  colorName: string;
  quantity: number;
  maxQuantity: number;
}
