import {Component, inject, input, OnInit, output} from '@angular/core';
import {ProductQuery} from '../../../dtos/products/product-dto';
import {Category} from '../../../dtos/categories/category-dto';
import {Brand} from '../../../dtos/brands/brand-dto';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {debounceTime, distinctUntilChanged} from 'rxjs';

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
        filter:values.filter?? undefined,
        categoryId:values.categoryId
      });
    });
  }

  categories = input.required<Category[]>();
  brands = input.required<Brand[]>();

  filtersChanged = output<Partial<ProductQuery>>();
}
