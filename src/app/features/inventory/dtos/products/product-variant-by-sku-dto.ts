export interface ProductVariantBySkuDto {
  id: GUID; // GUID
  sku: string;
  displayName: string;
  description: string;
  size: string;
  sizeId: GUID;
  colorId: GUID;
  colorName: string;
  price: number;
  averageCost?: number;
  branchId: GUID;
  availableStockInBranch: number;
  productId: GUID;
  productName: string;
  productDescription: string;
  gender: number | string;
  branchName: string;
  brandName: string;
  categoryName: string;
  isActive?: boolean;
}
