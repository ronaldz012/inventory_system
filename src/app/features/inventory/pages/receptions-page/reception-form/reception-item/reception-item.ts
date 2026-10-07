import { DecimalPipe } from '@angular/common';
import { Component, input, output, computed } from '@angular/core';
import { ItemForm, VariantForm } from '@features/inventory/models/variant-form.model';

interface ColorRow {
  colorId: GUID | null;
  colorName: string;
  items: VariantForm[];
  units: number;
}

@Component({
  selector: 'app-reception-item',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './reception-item.html',
})
export class ReceptionItem {
  group = input.required<ItemForm>();
  index = input.required<number>();
  remove = output<number>();
  edit = output<GUID>();

  totalUnits = computed(() =>
    this.group().variants.reduce((sum, v) => sum + v.quantityReceived!, 0),
  );

  totalCost = computed(() =>
    this.group().variants.reduce((sum, v) => sum + v.quantityReceived! * v.unitCost!, 0),
  );

  /** Variantes agrupadas por color (orden de aparición): una fila por color. */
  readonly rowsByColor = computed<ColorRow[]>(() => {
    const map = new Map<string, ColorRow>();
    for (const v of this.group().variants) {
      const key = v.colorId ?? v.colorName ?? '';
      let row = map.get(key);
      if (!row) {
        row = { colorId: v.colorId, colorName: v.colorName, items: [], units: 0 };
        map.set(key, row);
      }
      row.items.push(v);
      row.units += v.quantityReceived ?? 0;
    }
    return [...map.values()];
  });

  onRemove() {
    this.remove.emit(this.index());
  }

  onEdit() {
    this.edit.emit(this.group().product.id!);
  }
}
