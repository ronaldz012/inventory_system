import { min, required, schema } from '@angular/forms/signals';

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
  required(v.unitCost, { message: 'Requerido' });
  min(v.unitCost, 0.5, { message: 'Mín Bs 0.50' });
});

export const newVariantSchema = schema<VariantForm>((v) => {
  required(v.sizeId, { message: 'Requerido' });
  required(v.colorId, { message: 'Requerido' });
  required(v.quantityReceived, { message: 'Requerido' });
  min(v.quantityReceived, 1, { message: 'Mín 1' });
  required(v.unitCost, { message: 'Requerido' });
  min(v.unitCost, 0.5, { message: 'Mín Bs 0.50' });
  required(v.price, { message: 'Requerido' });
  min(v.price, 0.5, { message: 'Mín Bs 0.50' });
});

export function buildExistingVariant(): VariantForm {
  return {
    mode: 'ex',
    id: null,
    sizeId: '' as GUID,
    sizeName: '',
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
