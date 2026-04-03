export interface ProductSearchResult {
  id: number;
  name: string;
  description: string;
  basePrice: number;
  brandName: string;
  categoryName: string;
  productVariants: ProductVariantOption[];
  gender: number; // 0 unisex | 1 men | 2 woman
}
export interface ProductVariantOption {
  id: number;
  description: string;
  size: string;
  color: string;
  price: number;
}
