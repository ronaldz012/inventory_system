import { Component, computed, input, output, signal } from '@angular/core';
import { TransferItem } from '../../../../interfaces/transfer-item';
import { TransferRowSheet } from './transfer-row-sheet';

@Component({
  selector: 'app-create-transfer-item-list',
  imports: [TransferRowSheet],
  templateUrl: './create-transfer-item-list.html',
  styles: ``,
})
export class CreateTransferItemList {
  items = input.required<TransferItem[]>();
  itemsChange = output<TransferItem[]>();
  /** Fila resaltada tras agregar/sumar (la pone el padre, se limpia sola). */
  lastAddedId = input<GUID | null>(null);

  totalLines  = computed(() => this.items().length);
  totalUnits  = computed(() => this.items().reduce((sum, i) => sum + i.quantity, 0));

  /** Fila abierta en el sheet de edición (tap en la fila). */
  editingId = signal<GUID | null>(null);

  findItem(variantId: GUID): TransferItem | null {
    return this.items().find((i) => i.variantId === variantId) ?? null;
  }

  /** Filas agrupadas por producto (solo vista): preserva el orden de entrada. */
  groupedItems = computed(() => {
    const groups = new Map<
      GUID,
      { productId: GUID; productName: string; brandName: string; units: number; rows: TransferItem[] }
    >();
    for (const item of this.items()) {
      let g = groups.get(item.productId);
      if (!g) {
        g = { productId: item.productId, productName: item.productName, brandName: item.brandName, units: 0, rows: [] };
        groups.set(item.productId, g);
      }
      g.rows.push(item);
      g.units += item.quantity;
    }
    return [...groups.values()];
  });

  remove(variantId: GUID): void {
    this.itemsChange.emit(
      this.items().filter(i => i.variantId !== variantId)
    );
  }

  setQty(variantId: GUID, qty: number): void {
    this.itemsChange.emit(
      this.items().map(i =>
        i.variantId === variantId ? { ...i, quantity: qty } : i
      )
    );
  }
}
