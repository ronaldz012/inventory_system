import {Component, inject, input, output, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {CreateProductDto} from '../../interfaces/Dtos/create-product-dto';
import {AutocompleteInput} from '../autocomplete-input/autocomplete-input';
import {Category} from '../../interfaces/Dtos/category-dto';
import {Brand} from '../../interfaces/Dtos/brand-dto';
import {ProductService} from '../../services/product-service';

@Component({
  selector: 'app-product-form',
  imports: [
    ReactiveFormsModule,
    AutocompleteInput
  ],
  templateUrl: './product-form.html',
  styles: ``,
})
export class ProductForm {
  private fb = inject(FormBuilder);
  productService = inject(ProductService);
  isLoading = signal(false);
  formSubmitted = signal(false);
  onSaved = output<void>();
  categories = input.required<Category[]>()
  brands = input.required<Brand[]>()

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(6)]],
    description: ['', [Validators.required, Validators.minLength(6)]],
    basePrice: [0, [Validators.required, Validators.min(0.5)]],
    brandId: [1, [Validators.required, Validators.min(1)]],
    categoryId: [1, [Validators.required, Validators.min(1)]],
  })
  getError(field: string): string | null {
    const control = this.form.get(field);
    if (!control?.touched || !control?.invalid) return null;

    if (control.hasError('required'))  return 'Este campo es requerido';
    if (control.hasError('minlength')) return `Mínimo ${control.errors?.['minlength'].requiredLength} caracteres`;
    if (control.hasError('min')) return  `Debe Ser Mayor o igual ${control.errors?.['min'].min} `;

    return null;
  }
  submit(){
    if(this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      this.formSubmitted.set(true);
      return;
    }
    const dto: CreateProductDto = this.form.value as CreateProductDto;
    this.isLoading.set(true);
    this.formSubmitted.set(false);
    this.productService.CreateProduct(dto).subscribe({
      next: () => {

        this.isLoading.set(false);
        this.onSaved.emit();
      },
      error: (err: any) => {
        this.isLoading.set(false);
        console.error(err);
      }
    });

  }
}
