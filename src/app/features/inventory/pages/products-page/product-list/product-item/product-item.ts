import { Component, computed, input, output } from '@angular/core';
import { ListProductDto } from '../../../../dtos/products/list-product-dto';

@Component({
  selector: 'app-product-item',
  imports: [],
  templateUrl: './product-item.html',
  styles: ``,
})
export default class ProductItem {
  product = input.required<ListProductDto>();
  /** Grilla compartida con el header de la lista (una sola fuente de verdad). */
  gridColumns = input.required<string>();

  viewDetail = output<GUID>();

  /** Semántica de color por cantidad: 0 · bajo (1-4) · normal (5+). */
  readonly stockClasses = computed(() => {
    const total = this.product().totalStock;
    return total === 0
      ? 'text-feedback-error-text'
      : total < 5
        ? 'text-feedback-warning-text'
        : 'text-feedback-success-text';
  });
}
