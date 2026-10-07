import { Gender } from '../../interfaces/gender';

export interface ProductSearchResult {
  id: GUID;
  name: string;
  internalCode: string;
  description: string;
  basePrice: number;
  brandName: string;
  categoryName: string;
  gender: Gender;
  isActive?: boolean;
  variantsCount?: number;
  createdAt?: string;
  productVariants: ProductVariantOption[];
}
export interface ProductVariantOption {
  id: GUID;
  sku: string;
  size: string;
  sizeId: GUID;
  sizeOrder?: number;
  colorId: GUID;
  colorName: string;
  price: number;
  averageCost?: number;
}
