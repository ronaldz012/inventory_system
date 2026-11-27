import { min, required, schema, validate } from '@angular/forms/signals';

export interface Reception {
  notes: string;
  items: ItemForm[];
}
export interface ItemForm {
  product: ProductInfo;
  variants: VariantForm[];
}

export interface ProductInfo {
  id: GUID | null;
  productName: string;
  internalCode: string;
  categoryName: string;
  brandName: string;
  genderName: string;
  description: string;
}
export interface VariantForm {
  mode: 'ex' | 'new';
  id: GUID | null;
  sizeId: GUID;
  sizeName: string;
  sizeOrder: number;
  colorId: GUID;
  colorCode: string;
  colorName: string;
  quantityReceived: number | null;
  unitCost: number | null;
  price: number | null;
  sku: string;
  /** Legacy: ya nadie lo lee (la inclusión la marca quantityReceived). */
  selected?: boolean;
}
export const existingVariantSchema = schema<VariantForm>((v) => {
  required(v.id, { message: 'Seleccioná una talla/color' });
  required(v.quantityReceived, { message: 'Requerido' });
  min(v.quantityReceived, 1, { message: 'Mín 1' });
  // Costo vacío = desconocido (sale 0 al backend): el borrador lo permite y
  // el mínimo real (Bs 0.50) se exige al confirmar, no al armarlo.
  validate(v.unitCost, ({ value }) => {
    const cost = value();
    if (cost == null || cost >= 0) return null;
    return { kind: 'min', message: 'No puede ser negativo' };
  });
});

export const newVariantSchema = schema<VariantForm>((v) => {
  required(v.sizeId, { message: 'Requerido' });
  required(v.colorId, { message: 'Requerido' });
  required(v.quantityReceived, { message: 'Requerido' });
  min(v.quantityReceived, 1, { message: 'Mín 1' });
  validate(v.unitCost, ({ value }) => {
    const cost = value();
    if (cost == null || cost >= 0) return null;
    return { kind: 'min', message: 'No puede ser negativo' };
  });
  required(v.price, { message: 'Requerido' });
  min(v.price, 0.5, { message: 'Mín Bs 0.50' });
});

export function buildExistingVariant(): VariantForm {
  return {
    mode: 'ex',
    id: null,
    sizeId: '' as GUID,
    sizeName: '',
    sizeOrder: 0,
    colorId: '' as GUID,
    colorCode: '',
    colorName: '',
    price: null,
    quantityReceived: null,
    unitCost: null,
    sku: '',
    selected: false,
  };
}

export function buildNewVariant(): VariantForm {
  return {
    mode: 'new',
    id: '' as GUID,
    sizeId: '' as GUID,
    sizeName: '',
    sizeOrder: 0,
    colorId: '' as GUID,
    colorCode: '',
    colorName: '',
    price: null,
    quantityReceived: null,
    unitCost: null,
    sku: '',
    selected: false,
  };
}
