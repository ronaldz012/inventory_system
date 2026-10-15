export interface ListProductDto {
  id: GUID;
  name: string;
  internalCode: string;
  categoryName: string;
  brandName: string;
  variantsCount: number;
  totalStock: number;
  basePrice: number;
  isActive: boolean;
  minPrice: number;
  maxPrice: number;
  colors: string[];
}
