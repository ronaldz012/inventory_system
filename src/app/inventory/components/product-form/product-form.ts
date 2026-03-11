import {Component, inject, output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CreateProductDto} from '../../interfaces/Dtos/create-product-dto';

@Component({
  selector: 'app-product-form',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './product-form.html',
  styles: ``,
})
export class ProductForm {
  private fb = inject(FormBuilder);


  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(6)]],
    description: ['', [Validators.required, Validators.minLength(6)]],
    basePrice: [0, [Validators.required, Validators.min(0.1)]],
    brandId: [0, [Validators.required, Validators.min(1)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
  })

  submit(){
    if(!this.form.invalid)
    {
      const dto: CreateProductDto = this.form.value as CreateProductDto;
    }
    return;
  }
}
