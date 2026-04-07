import {Component, DestroyRef, inject, input, output} from '@angular/core';
import {ProductService} from '../../../../../services/product-service';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {NewProductFormGroup} from '../../common/item-form-group';
import {Category} from '../../../../../interfaces/Dtos/category-dto';
import {Brand} from '../../../../../interfaces/Dtos/brand-dto';

@Component({
  selector: 'app-new-product',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './new-product.html',
  styles: [`
  :host {
    display: contents;
  }
  `],
})
export  default class NewProduct {
//--Dependencies---------------------------
  private destroyRef     = inject(DestroyRef);

  //--Inputs ----------------------------------------------
  form = input.required<NewProductFormGroup>()
  categories = input.required<Category[]>()
  brands = input.required<Brand[]>()

  //--Outputs------------------------------------------------
  switchMode = output<void>();
  remove = output<void>();


  // 1. Definición de opciones de género
  readonly genderOptions = [
    { label: 'Unisex', value: 0 },
    { label: 'Hombre', value: 1 },
    { label: 'Mujer', value: 2 }
  ];

// 2. Manejo de la Marca (Logic para el ID)
  onBrandChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Buscamos el objeto marca que coincida con el nombre escrito
    const brand = this.brands().find(b => b.name.toLowerCase() === value.toLowerCase());

    if (brand) {
      this.form().patchValue({ brandId: brand.id });
    } else {
      // Si la marca no existe, reseteamos el ID
      this.form().patchValue({ brandId: null });
      // Opcional: podrías marcar error si no permites marcas nuevas
      // this.form().get('brandName')?.setErrors({ notFound: true });
    }
  }
  onCategoryChange(event: any) {
    const value = event.target.value;
    const category = this.categories().find(c => c.name === value);

    if (category) {
      this.form().patchValue({ categoryId: category.id });
    } else {
      // Si quieres obligar a que elija una existente
      this.form().get('categoryName')?.setErrors({ invalid: true });
    }
  }
}
