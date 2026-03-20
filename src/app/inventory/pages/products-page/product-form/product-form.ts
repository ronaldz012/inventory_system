import {Component, computed, inject, input, OnInit, output, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CreateProductDto} from '../../../interfaces/Dtos/create-product-dto';
import {AutocompleteInput} from '../../../components/autocomplete-input/autocomplete-input';
import {Category} from '../../../interfaces/Dtos/category-dto';
import {Brand} from '../../../interfaces/Dtos/brand-dto';
import {ProductService} from '../../../services/product-service';
import {NewProductFormGroup} from '../../receptions-page/reception-form/common/item-form-group';

@Component({
  selector: 'app-product-form',
  imports: [
    ReactiveFormsModule,
    AutocompleteInput
  ],
  templateUrl: './product-form.html',
  styles: ``,
})
export class ProductForm  implements OnInit {
  ngOnInit(): void {
    console.log('externalForm recibido:', this.externalForm());
    this.form = this.externalForm() ?? this.fb.group({
      name: ['', [Validators.required, Validators.minLength(6)]],
      description: ['', [Validators.required, Validators.minLength(6)]],
      basePrice: [0, [Validators.required, Validators.min(0.5)]],
      brandId: [1, [Validators.required, Validators.min(1)]],
      categoryId: [1, [Validators.required, Validators.min(1)]],
    });
    console.log('form usado:', this.form);
  }
  private fb = inject(FormBuilder);
  externalForm = input<NewProductFormGroup | null>(null);

  form!: FormGroup;
  productService = inject(ProductService);
  isLoading = signal(false);
  formSubmitted = signal(false);
  onSaved = output<void>();
  categories = input.required<Category[]>()
  brands = input.required<Brand[]>()

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
    const dto = this.form.value as unknown as CreateProductDto;
    this.isLoading.set(true);
    this.formSubmitted.set(false);
    this.productService.createProduct(dto).subscribe({
      next: () => {

        this.isLoading.set(false);
        this.onSaved.emit();
      },
      error: (err: any) => {
        this.isLoading.set(false)
        console.error(err);
      }
    });

  }
  onlyNumbers(event: KeyboardEvent) {
    if (['e', 'E', '+', '-'].includes(event.key)) {
      event.preventDefault();
    }
  }

  clearIfZero() {
    if (this.form.get('basePrice')?.value === 0) {
      this.form.patchValue({ basePrice: null as unknown as number });
    }
  }
}
