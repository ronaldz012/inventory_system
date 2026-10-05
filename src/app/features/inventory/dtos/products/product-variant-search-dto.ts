import { Gender } from '../../interfaces/gender';

/** Resultado plano del endpoint de búsqueda para el POS (una fila por variante). */
export interface ProductVariantSearchDto {
  id: GUID;
  sku: string;
  productId: GUID;
  productName: string;
  brandName: string;
  categoryName: string;
  gender: Gender;
  colorId: GUID;
  colorName: string;
  sizeId: GUID;
  size: string;
  price: number;
  availableStockInBranch: number;
}
