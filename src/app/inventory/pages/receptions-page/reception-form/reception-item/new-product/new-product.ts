import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NewProductFormGroup } from '../../common/item-form-group';
import { Category } from '../../../../../interfaces/Dtos/category-dto';
import { Brand } from '../../../../../interfaces/Dtos/brand-dto';
import { CategoryService } from '../../../../../services/category-service';
import { BrandService } from '../../../../../services/brand-service';
import {CreateCategory} from '../../../../../components/create-category/create-category';
import {CreateBrand} from '../../../../../components/create-brand/create-brand';
import {selectFromList} from '../../../../../../core/select-from-list/select-from-list';

@Component({
  selector: 'app-new-product',
  imports: [ReactiveFormsModule, selectFromList],
  templateUrl: './new-product.html',
  styles: [`:host { display: contents; }`],
})
export default class NewProduct {
  private destroyRef   = inject(DestroyRef);
  private categoryService = inject(CategoryService);
  private brandService    = inject(BrandService);


  form       = input.required<NewProductFormGroup>();
  categories = input.required<Category[]>();
  brands     = input.required<Brand[]>();

  switchMode = output<void>();
  remove     = output<void>();
  openCreation = output<{type: 'category' | 'brand', query: string}>();

// Guardamos el texto actual para cuando se dispare la creación
  private currentCategoryQuery = '';
  private currentBrandQuery = '';
  readonly genderOptions = [
    { label: 'Unisex', value: 0 },
    { label: 'Hombre', value: 1 },
    { label: 'Mujer', value: 2 }
  ];
  private brandCreated: any;

  onBrandChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (value === '+ CREAR NUEVA MARCA') {

         // this.openCreation.emit('brand', 'xd'); //this.form().patchValue({ brandName: '' });
      return;
    }
    const brand = this.brands().find(b => b.name.toLowerCase() === value.toLowerCase());
    this.form().patchValue({ brandId: brand?.id ?? null });
  }

  onCategoryInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    this.currentCategoryQuery = value;
    const match = this.categories().find(c => c.name.toLowerCase() === value.toLowerCase());
    this.form().patchValue({ categoryId: match ? match.id : null });
  }
  handleCreateCategory(text: string) {
    console.log('creando'+text);
    this.openCreation.emit({ type: 'category', query: text });
  }

  handleCreateBrand(text: string) {
    this.openCreation.emit({ type: 'brand', query: text });
  }

}
