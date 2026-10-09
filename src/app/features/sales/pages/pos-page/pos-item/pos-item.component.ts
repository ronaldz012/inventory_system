import { Component, input, output, computed, signal } from '@angular/core';
import { FieldTree, FormField, form, min, validate } from '@angular/forms/signals';
import { blockNonNumericKeys } from '@shared/utils/list-query';
import { CommonModule } from '@angular/common';
import { PosCartItem } from '@features/sales/models/pos-sale-state.model';

@Component({
  selector: 'app-pos-cart-item-card',
  standalone: true,
  imports: [CommonModule, FormField],
  templateUrl: './pos-item.component.html',
})
export class PosCartItemCardComponent {
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;
  // Inputs
  item = input.required<FieldTree<PosCartItem>>();

  removed = output<void>();

  hasDiscount = computed(() => {
    const original = this.item().originalPrice().value();
    const selling = this.item().sellingPrice().value();
    return selling < original;
  });

  subtotal = computed(() => {
    const price = this.item().sellingPrice().value();
    const qty = this.item().quantity().value();
    return price * qty;
  });

  adjustPrice(delta: number) {
    const currentPrice = this.item().sellingPrice().value();
    const originalPrice = this.item().originalPrice().value();

    const newPrice = Math.max(0, currentPrice + delta);

    this.item().sellingPrice().value.set(newPrice);
    this.item()
      .discountAmount()
      .value.set(originalPrice - newPrice);
  }

  onPriceInput(event: Event) {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    const newPrice = isNaN(raw) ? 0 : Math.max(0, raw);
    const originalPrice = this.item().originalPrice().value();

    this.item().sellingPrice().value.set(newPrice);
    this.item()
      .discountAmount()
      .value.set(originalPrice - newPrice);
  }

  // ── Controles de Cantidad ──────────────────────────────────────────

  adjustQty(delta: number) {
    const currentQty = this.item().quantity().value();
    const maxStock = this.item().stock().value();

    const newQty = Math.max(1, Math.min(maxStock, currentQty + delta));

    this.item().quantity().value.set(newQty);
  }

  onRemove() {
    this.removed.emit();
  }
}
