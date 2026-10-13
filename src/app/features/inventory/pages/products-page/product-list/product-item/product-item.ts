import { Component, computed, inject, input, LOCALE_ID, output } from '@angular/core';
import { ListProductDto } from '../../../../dtos/products/list-product-dto';
import { PermissionService } from '@features/auth/services/permmision-service';
import { formatMoney } from '@shared/pipes/money-pipe';

const MAX_VISIBLE_COLORS = 4;

@Component({
  selector: 'app-product-item',
  imports: [],
  templateUrl: './product-item.html',
  styles: ``,
})
export default class ProductItem {
  private perm = inject(PermissionService);
  private readonly locale = inject(LOCALE_ID);
  product = input.required<ListProductDto>();
  /** Grilla compartida con el header de la lista (una sola fuente de verdad). */
  gridColumns = input.required<string>();

  viewDetail = output<GUID>();
  editProduct = output<GUID>();

  canEdit = computed(() => this.perm.can('inventory', 'products', 'update'));

  /** Semántica de color por cantidad: 0 · bajo (1-4) · normal (5+). */
  readonly stockClasses = computed(() => {
    const total = this.product().totalStock;
    return total === 0
      ? 'text-feedback-error-text'
      : total < 5
        ? 'text-feedback-warning-text'
        : 'text-feedback-success-text';
  });

  /** Primeros N colores + resto en "+N" (el title lleva todos). */
  readonly visibleColors = computed(() => this.product().colors.slice(0, MAX_VISIBLE_COLORS));
  readonly extraColorsCount = computed(() =>
    Math.max(0, this.product().colors.length - MAX_VISIBLE_COLORS),
  );
  readonly allColorNames = computed(() => this.product().colors.join(', '));

  /** Rango único sin moneda (el header lleva el Bs); si min==max muestra uno solo. */
  readonly priceLabel = computed(() => {
    const { minPrice, maxPrice } = this.product();
    const min = formatMoney(minPrice, this.locale);
    return minPrice === maxPrice ? min : `${min}–${formatMoney(maxPrice, this.locale)}`;
  });
}
