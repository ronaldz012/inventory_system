// features/receptions/components/reception-filter-bar/reception-filter-bar.ts
import { Component, input, output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ReceptionQueryParams,
  ReceptionStatus,
} from '../../../dtos/receptions/stock-reception-list-dto';
import { DateRangeFilter } from '@shared/components/date-range-filter/date-range-filter';
import { BrandService } from '@features/inventory/services/brand-service';

@Component({
  selector: 'app-reception-filter-bar',
  standalone: true,
  imports: [FormsModule, DateRangeFilter],
  template: `
    <div class="flex flex-wrap gap-2 items-center">
      <!-- Rango de fechas -->
      <app-date-range-filter
        [from]="params().dateFrom"
        [to]="params().dateTo"
        (rangeChange)="emit({ dateFrom: $event.from, dateTo: $event.to, page: 1 })"
      />

      <!-- Status -->
      <select
        class="py-2 px-3 text-sm border border-border rounded-xl bg-bg-surface
             text-text-muted focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
        [ngModel]="params().status ?? ''"
        (ngModelChange)="emit({ status: $event !== '' ? +$event : undefined, page: 1 })"
      >
        <option value="">Todos los estados</option>
        <option [value]="ReceptionStatus.Borrador">Borrador</option>
        <option [value]="ReceptionStatus.Confirmado">Confirmada</option>
        <option [value]="ReceptionStatus.Revertida">Revertida</option>
      </select>

      <!-- Marca -->
      <select
        class="py-2 px-3 text-sm border border-border rounded-xl bg-bg-surface
             text-text-muted focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
        [ngModel]="params().brandId ?? ''"
        (ngModelChange)="emit({ brandId: $event || undefined, page: 1 })"
      >
        <option value="">Todas las marcas</option>
        @for (b of brands(); track b.id) {
          <option [value]="b.id">{{ b.name }}</option>
        }
      </select>

      <!-- Clear -->
      @if (hasActiveFilters()) {
        <button class="btn-secondary btn-sm rounded-xl text-text-soft" (click)="clearAll()">
          ✕ Limpiar
        </button>
      }
    </div>
  `,
})
export class ReceptionFilterBar {
  params = input.required<ReceptionQueryParams>();
  change = output<Partial<ReceptionQueryParams>>();

  // Exponer el enum al template
  readonly ReceptionStatus = ReceptionStatus;

  private brandService = inject(BrandService);
  brands = signal<{ id: GUID; name: string }[]>([]);

  constructor() {
    // this.brandService.getAll().subscribe(r => this.brands.set(r));
  }

  emit(patch: Partial<ReceptionQueryParams>) {
    this.change.emit(patch);
  }

  hasActiveFilters(): boolean {
    const p = this.params();
    return !!(p.dateFrom || p.dateTo || p.status !== undefined || p.brandId);
  }

  clearAll() {
    this.change.emit({
      dateFrom: undefined,
      dateTo: undefined,
      status: undefined,
      brandId: undefined,
      page: 1,
    });
  }
}
