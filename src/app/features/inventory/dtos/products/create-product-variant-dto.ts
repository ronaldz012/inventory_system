export interface CreateProductVariantDto {
  sizeId: GUID;
  price: number;
  colorId: GUID;
}

export interface CreateProductVariantsRequest {
  variants: CreateProductVariantDto[];
}

export interface ProductVariantCreatedDto {
  productVariantId: GUID;
  sku: string;
  size: string;
  colorName: string;
  sizeOrder?: number;
}
