/**
 * Modelo del formulario de creación: un color agrupa sus tallas y cada talla
 * conserva su propio precio, editable de forma individual.
 */
export interface SizePriceForm {
  sizeId: GUID;
  sizeName: string;
  price: number | null;
}

export interface ColorGroupForm {
  /** Identidad local estable para `@for`; no se envía al backend. */
  id: string;
  colorId: GUID;
  colorName: string;
  sizes: SizePriceForm[];
}

let nextColorGroupId = 0;

export function buildNewColorGroup(): ColorGroupForm {
  return {
    id: `cg-${++nextColorGroupId}`,
    colorId: '' as GUID,
    colorName: '',
    sizes: [],
  };
}
