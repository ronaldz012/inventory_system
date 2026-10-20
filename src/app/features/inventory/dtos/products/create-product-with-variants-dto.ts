import { Gender } from '../../interfaces/gender';
import { CreateProductVariantDto } from './create-product-variant-dto';

export interface CreateProductWithVariantsDto {
  name: string;
  description: string;
  categoryId: GUID;
  brandId: GUID;
  gender: Gender;
  variants: CreateProductVariantDto[];
}

/** Variante devuelta al crear el producto: datos completos, sin cruces. */
export interface CreatedProductVariantDto {
  id: GUID;
  sku: string;
  size: string;
  sizeId: GUID;
  sizeOrder: number;
  colorId: GUID;
  colorName: string;
  price: number;
}

export interface ProductWithVariantsCreatedDto {
  id: GUID;
  name: string;
  internalCode: string;
  description: string;
  brandName: string;
  categoryName: string;
  gender: Gender;
  isActive?: boolean;
  variants: CreatedProductVariantDto[];
}
