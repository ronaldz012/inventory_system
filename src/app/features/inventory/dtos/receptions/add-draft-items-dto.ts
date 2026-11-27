/**
 * POST /api/Reception/{id}/items — agrega variantes existentes a un borrador.
 *
 * El backend hace upsert por `productVariantId`:
 *  - no existe → crea la línea;
 *  - ya existe → suma `quantityReceived` y solo reemplaza `unitCost` si > 0.
 * No se admiten IDs duplicados dentro del mismo request.
 */
export interface AddDraftItemsDto {
  items: AddDraftItemDto[];
}

export interface AddDraftItemDto {
  productVariantId: GUID;
  quantityReceived: number;
  /** 0 = conservar el costo actual si la variante ya está en el borrador. */
  unitCost: number;
}
