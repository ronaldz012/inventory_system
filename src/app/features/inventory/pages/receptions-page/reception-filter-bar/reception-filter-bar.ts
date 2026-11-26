// features/receptions/components/reception-filter-bar/reception-filter-bar.ts
import { Component, OnDestroy, input, output, inject, signal } from '@angular/core';
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
      <!-- Búsqueda (backend: # exacto o proveedor/marca/notas) -->
      <div class="relative flex-1 min-w-[12rem]">
        <span
          class="material-icons absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-text-soft pointer-events-none"
          >search</span
        >
        <input
          type="search"
          [value]="params().filter ?? ''"
          (input)="onFilterInput($event)"
          placeholder="Buscar #, proveedor, marca o notas…"
          aria-label="Buscar recepciones"
          class="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl bg-bg-surface
                 text-text-main placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
        />
      </div>

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
export class ReceptionFilterBar implements OnDestroy {
  params = input.required<ReceptionQueryParams>();
  change = output<Partial<ReceptionQueryParams>>();

  // Exponer el enum al template
  readonly ReceptionStatus = ReceptionStatus;

  private brandService = inject(BrandService);
  brands = signal<{ id: GUID; name: string }[]>([]);

  /** Debounce del buscador: el backend filtra, no queremos un GET por tecla. */
  private filterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // this.brandService.getAll().subscribe(r => this.brands.set(r));
  }

  ngOnDestroy(): void {
    if (this.filterTimer) clearTimeout(this.filterTimer);
  }

  emit(patch: Partial<ReceptionQueryParams>) {
    this.change.emit(patch);
  }

  onFilterInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => {
      this.filterTimer = null;
      this.emit({ filter: value.trim() || undefined, page: 1 });
    }, 400);
  }

  hasActiveFilters(): boolean {
    const p = this.params();
    return !!(p.dateFrom || p.dateTo || p.status !== undefined || p.brandId || p.filter);
  }

  clearAll() {
    if (this.filterTimer) {
      clearTimeout(this.filterTimer);
      this.filterTimer = null;
    }
    this.change.emit({
      dateFrom: undefined,
      dateTo: undefined,
      status: undefined,
      brandId: undefined,
      filter: undefined,
      page: 1,
    });
  }
}
