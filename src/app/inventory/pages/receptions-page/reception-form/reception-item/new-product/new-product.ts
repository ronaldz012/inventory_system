import {Component, DestroyRef, inject, input, output} from '@angular/core';
import {ProductService} from '../../../../../services/product-service';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {NewProductFormGroup} from '../../common/item-form-group';

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
export class NewProduct {
//--Dependencies---------------------------
  private destroyRef     = inject(DestroyRef);

  //--Inputs ----------------------------------------------
  form = input.required<NewProductFormGroup>()
  //--Outputs------------------------------------------------
  switchMode = output<void>();
  remove = output<void>();

  getGenderLabel(gender: number | null): string {
    switch (gender) {
      case 0: return 'Unisex';
      case 1: return 'Hombre';
      case 2: return 'Mujer';
      default: return '—';
    }
  }

}
