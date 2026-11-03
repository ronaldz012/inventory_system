import { Gender } from '../../interfaces/gender';

export interface BranchStockDto {
  branchId: GUID;
  branchName: string;
  stock: number;
}

export interface ProductDetailDto {
  id: GUID;
  name: string;
  internalCode: string;
  description: string;
  basePrice: number;
  gender: Gender;
  categoryId: GUID;
  categoryName: string;
  brandId: GUID;
  brandName: string;
  totalAvailable: number;
  isActive: boolean;
  variants: ProductVariantDto[];
}

export interface ProductVariantDto {
  id: GUID;
  sku: string;
  description: string;
  size: string;
  sizeId: GUID;
  sizeOrder?: number;
  color: string;
  colorId: GUID;
  price: number;
  averageCost?: number;
  /** Último costo de compra confirmado (null si nunca se compró). */
  lastPurchaseCost?: number | null;
  lastPurchaseAt?: string | null;
  totalAvailable: number;
  branchStocks: BranchStockDto[];
}
