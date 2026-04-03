import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { VariantFormGroup } from './variant-form-group'; // si está en el mismo archivo, ignorá este import


export type NewReceptionForm = FormGroup<{
  notes: FormControl<string>;
  items: FormArray<ItemFormGroup>;
}>;
export type ItemFormGroup = FormGroup<{
  productId: FormControl<number | null>;
  newProduct: NewProductFormGroup;
  variants: FormArray<VariantFormGroup>;
}>;

export type NewProductFormGroup = FormGroup<{
  name: FormControl<string>;
  description: FormControl<string>;
  categoryId: FormControl<number | null>;
  brandId: FormControl<number | null>;
  gender: FormControl< gender | null>; // 0 unisex | 1
  basePrice: FormControl<number>;
  // unitMeasurementSin: FormControl<number | null>;
  // economicActivity: FormControl<string>;
  // productCodeSin: FormControl<number | null>;
}>;

enum gender  {unisex, men, woman }
