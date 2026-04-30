import { Component, computed, input, output} from '@angular/core';
import {TransferItem} from '../../../../interfaces/transfer-item';

@Component({
  selector: 'app-create-transfer-item-list',
  imports: [],
  templateUrl: './create-transfer-item-list.html',
  styles: ``,
})
export class CreateTransferItemList {
  items = input.required<TransferItem[]>();
  itemsChange = output<TransferItem[]>();

  totalLines  = computed(() => this.items().length);
  totalUnits  = computed(() => this.items().reduce((sum, i) => sum + i.quantity, 0));

  increment(item: TransferItem): void {
    if (item.quantity >= item.maxQuantity) return;
    this.emit(item.variantId, item.quantity + 1);
  }

  decrement(item: TransferItem): void {
    if (item.quantity <= 1) return;
    this.emit(item.variantId, item.quantity - 1);
  }

  remove(variantId: number): void {
    this.itemsChange.emit(
      this.items().filter(i => i.variantId !== variantId)
    );
  }

  private emit(variantId: number, newQty: number): void {
    this.itemsChange.emit(
      this.items().map(i =>
        i.variantId === variantId ? { ...i, quantity: newQty } : i
      )
    );
  }
}
