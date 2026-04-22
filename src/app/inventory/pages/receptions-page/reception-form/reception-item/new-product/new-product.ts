import {Component, DestroyRef, inject, input, output, ViewChild, ElementRef, OnInit, OnDestroy} from '@angular/core';
import {ReactiveFormsModule, Validators} from '@angular/forms';
import { NewProductFormGroup } from '../../common/item-form-group';
import { Category } from '../../../../../dtos/categories/category-dto';
import { Brand } from '../../../../../dtos/brands/brand-dto';
import { SelectFromList } from '../../../../../../core/select-from-list/select-from-list';
import { CreateEntityEvent } from '../../../../../interfaces/types/create-entity-event';
import {ProductSearchResult} from '../../../../../components/product-search/product-search-result';

@Component({
  selector: 'app-new-product',
  standalone: true,
  imports: [ReactiveFormsModule, SelectFromList, SelectFromList],
  templateUrl: './new-product.html',
  styles: [`:host { display: contents; }`],
})
export default class NewProduct implements OnInit,OnDestroy {
  form = input.required<NewProductFormGroup>();
  categories = input.required<Category[]>();
  brands = input.required<Brand[]>();
  index = input.required<number>();

  switchMode = output<void>();
  remove = output<void>();
  openCreation = output<CreateEntityEvent>();
  productSelected = output<ProductSearchResult>()

  readonly genderOptions = [
    { label: 'UNISEX', value: 0 },
    { label: 'HOMBRE', value: 1 },
    { label: 'MUJER', value: 2 }
  ];

  ngOnInit(): void {
     this.form().controls.name.setValidators([Validators.required]);
     this.form().controls.categoryId.setValidators([Validators.required]);
     this.form().controls.brandId.setValidators([Validators.required]);
     this.form().controls.gender.setValidators([Validators.required]);
    this.form().controls.basePrice.setValidators([Validators.required]);
  }

  onCategorySelected(category: Category | null) {
    this.form().patchValue({ categoryId: category?.id ?? null });
  }
  onBrandSelected(brand: Brand | null) {
    this.form().patchValue({ brandId: brand?.id ?? null});
  }


  handleCreateBrand(text: string) {
    this.openCreation.emit({ type: 'brand', query: text, itemIndex: this.index() });
  }

  handleCreateCategory(text: string) {
    this.openCreation.emit({ type: 'category', query: text, itemIndex: this.index() });
  }


  ngOnDestroy(): void {
    const group = this.form();

    Object.values(group.controls).forEach(control => {
      control.clearValidators();
      control.updateValueAndValidity({ emitEvent: false, onlySelf: true });
    });
    group.clearValidators();
    group.reset();
    group.updateValueAndValidity({ emitEvent: false });
  }
}
