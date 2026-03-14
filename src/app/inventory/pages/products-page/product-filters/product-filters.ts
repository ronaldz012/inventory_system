import {Component, inject, input, OnInit, output} from '@angular/core';
import {ProductQuery} from '../../../interfaces/Dtos/product-dto';
import {Category} from '../../../interfaces/Dtos/category-dto';
import {Brand} from '../../../interfaces/Dtos/brand-dto';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {debounceTime, distinctUntilChanged} from 'rxjs';
import {validate} from '@angular/forms/signals';

@Component({
  selector: 'app-product-filters',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './product-filters.html',
  styles: ``,
})
export  default  class ProductFilters implements OnInit {
  private fb = inject(FormBuilder);
  filtersForm = this.fb.group(
    {
      filter: [null,Validators.required],
      categoryId: [null, [Validators.required]],
      brandId:[null, [Validators.required]],
    })


  ngOnInit(): void {
    this.filtersForm.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(values => {
      this.filtersChanged.emit({
        filter:this.filtersForm.value.filter?? undefined,
        brandId: this.filtersForm.value.brandId,
        categoryId: this.filtersForm.value.categoryId
      });
    });
  }

  categories = input.required<Category[]>();
  brands = input.required<Brand[]>();

  filtersChanged = output<Partial<ProductQuery>>();
}
