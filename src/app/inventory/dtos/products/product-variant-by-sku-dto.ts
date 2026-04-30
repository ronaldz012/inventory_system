export interface ProductVariantBySkuDto {
  id: number;
  sku: string;
  description: string;
  size: string;
  color: string;
  availableStockInBranch: number;
  productName: string;
}
