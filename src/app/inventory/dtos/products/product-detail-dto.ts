export interface ProductDetailDto {
  id: number;
  name: string;
  internalCode: string;
  description: string;
  basePrice: number;
  gender: string;
  categoryName: string;
  brandName: string;
  totalStockInBranches: number;
  variants: ProductVariantDto[];
}

export interface ProductVariantDto {
  id: number;
  sku: string;
  description: string;
  size: string;
  color: string;
  price: number;
  stock: VariantStockDto[];
  stockOfVariantInBranches: number;
}

export interface VariantStockDto {
  branchId: number;
  branchName: string;
  stock: number;
}
