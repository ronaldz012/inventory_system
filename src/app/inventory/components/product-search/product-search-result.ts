import {Gender} from '../../interfaces/gender';

export interface ProductSearchResult {
  id: number;
  name: string;
  internalCode : string;
  description: string;
  basePrice: number;
  brandName: string;
  categoryName: string;
  productVariants: ProductVariantOption[];
  gender: Gender;
}
export interface ProductVariantOption {
  id: number;
  sku: string;
  description: string;
  size: string;
  color: string;
  price: number;
}
