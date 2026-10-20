import { ColorGroupForm } from './color-group-form.model';

export interface NewProductModelForm {
  newProduct: newProductDataModel;
  colorGroups: ColorGroupForm[];
}
export interface newProductDataModel {
  name: string;
  description: string;
  categoryId: GUID;
  categoryName: string;
  brandId: GUID;
  brandName: string;
  /** Valor crudo del `<select>`; se convierte a `Gender` al enviar. */
  gender: string;
}
