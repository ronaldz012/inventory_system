import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SaleService } from '@features/sales/services/sale-service';
import { SaleListDto } from '@features/sales/dtos/sale-list-dto';
import { SalesQueryDto } from '@features/sales/dtos/sales-query-dto';
import { DateRangeFilter, DateRange } from '@shared/components/date-range-filter/date-range-filter';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import { Paginator } from '@shared/components/app-paginator/app-paginator';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { SaleType, isReturnType } from '@features/sales/dtos/sale-detail-dto';

@Component({
  selector: 'app-sales-list-page',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, DateRangeFilter, SmartDatePipe, Paginator, SkeletonList],
  template: `
    <div class="flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-lg font-black text-text-main">Ventas</h1>
      </div>

      <app-date-range-filter (rangeChange)="onDateRange($event)" />

      <!-- Filtros tipo + reembolso -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1.5 bg-bg-surface rounded-xl border border-border p-1">
          <button type="button" (click)="setType(null)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            [class]="query().type == null ? 'bg-accent-ui text-white shadow-sm' : 'text-text-muted hover:bg-bg-muted'">Todos</button>
          <button type="button" (click)="setType(SaleType.Sale)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            [class]="query().type === SaleType.Sale ? 'bg-accent-ui text-white shadow-sm' : 'text-text-muted hover:bg-bg-muted'">Ventas</button>
          <button type="button" (click)="setType(SaleType.Return)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            [class]="query().type === SaleType.Return ? 'bg-accent-ui text-white shadow-sm' : 'text-text-muted hover:bg-bg-muted'">Devoluciones</button>
        </div>
        <div class="flex items-center gap-1.5 bg-bg-surface rounded-xl border border-border p-1">
          <button type="button" (click)="setHasReturn(null)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            [class]="query().hasReturn == null ? 'bg-bg-muted text-text-main border border-border' : 'text-text-muted hover:bg-bg-muted'">Todos</button>
          <button type="button" (click)="setHasReturn(true)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            [class]="query().hasReturn === true ? 'bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30' : 'text-text-muted hover:bg-bg-muted'">Con reembolso</button>
          <button type="button" (click)="setHasReturn(false)" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            [class]="query().hasReturn === false ? 'bg-bg-muted text-text-main border border-border' : 'text-text-muted hover:bg-bg-muted'">Sin reembolso</button>
        </div>
        @if (hasActiveFilters()) {
          <button type="button" (click)="clearFilters()" class="text-xs font-bold text-accent-ui hover:underline ml-1">Limpiar</button>
        }
      </div>

      @if (loading()) {
        <app-skeleton-list [rows]="4" [columns]="3" />
      } @else if (error()) {
        <div class="flex flex-col items-center gap-3 p-8 rounded border border-border bg-bg-surface shadow-sm">
          <span class="material-icons text-3xl text-feedback-error-text">error_outline</span>
          <p class="text-sm text-text-main">{{ error() }}</p>
          <button class="btn btn-primary btn-sm" (click)="load()">Reintentar</button>
        </div>
      } @else if (sales().length === 0) {
        <div class="flex flex-col items-center justify-center gap-3 py-20 bg-bg-surface border border-dashed border-border rounded-2xl text-text-soft">
          <div class="w-16 h-16 rounded-full bg-bg-muted flex items-center justify-center text-text-soft/40">
            <span class="material-icons text-[36px]">receipt</span>
          </div>
          <div class="text-center px-6">
            <p class="font-bold text-text-main text-sm">Sin ventas</p>
            <p class="text-xs max-w-xs mt-1">No se encontraron ventas{{ hasDateFilter() || hasActiveFilters() ? ' con los filtros seleccionados' : '' }}.</p>
          </div>
          @if (hasDateFilter() || hasActiveFilters()) {
            <button class="text-xs font-bold text-accent-ui hover:underline" (click)="clearFilters()">Limpiar filtros</button>
          }
        </div>
      } @else {
        <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div class="hidden lg:grid px-4 py-3 bg-bg-muted border-b border-border table-header"
            [style.grid-template-columns]="gridCols"
          >
            <span>Nº</span>
            <span>Fecha</span>
            <span>Producto</span>
            <span class="text-center">Tipo</span>
            <span class="text-center">Artículos</span>
            <span class="text-right">Total</span>
            <span class="text-center">Reembolso</span>
            <span></span>
          </div>

          <ul class="flex flex-col divide-y divide-border">
            @for (sale of sales(); track sale.id) {
              <li class="row-enter bg-bg-surface relative overflow-hidden border-b border-border transition-all duration-200 hover:shadow-md"
                  [class.border-l-4]="isReturnType(sale.type)"
                  [class.border-feedback-warning]="isReturnType(sale.type)">
                <div class="absolute bottom-0 left-0 top-0 w-[4px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 lg:block hidden"
                     [class.bg-accent-ui]="!isReturnType(sale.type)" [class.bg-feedback-warning]="isReturnType(sale.type)"></div>

                <!-- MOBILE -->
                <div class="flex items-center gap-4 px-4 py-3.5 lg:hidden">
                  <div class="flex flex-col min-w-0 flex-1">
                    <p class="flex items-center gap-1.5 truncate font-inter text-sm font-bold leading-tight text-text-main">
                      <span class="font-mono">#{{ sale.number }}</span>
                      ·
                      {{ sale.createdAt | smartDate }}
                      @if (isReturnType(sale.type)) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30">Devolución</span>
                      }
                      @if (sale.hasReturn) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent-ui/10 text-accent-ui">Reembolsada</span>
                      }
                    </p>
                    <p class="truncate text-xs text-text-muted mt-0.5">{{ sale.firstItemDisplayName || '—' }}</p>
                    <p class="mt-1 font-inter text-xs text-text-muted flex flex-wrap items-center gap-1.5">
                      <span class="font-bold" [class.text-accent-ui]="!isReturnType(sale.type)" [class.text-feedback-warning-text]="isReturnType(sale.type)">{{ sale.totalAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                      <span class="font-bold text-accent-ui bg-accent-ui/10 px-1.5 py-0.5 rounded text-[11px]">{{ sale.totalDistinctItems }} art. · {{ sale.totalQuantity }} unid.</span>
                      @if (sale.hasReturn) {
                        <span class="text-feedback-warning-text bg-feedback-warning/10 px-1.5 py-0.5 rounded text-[11px]">Dev. {{ sale.returnedAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                      }
                      <span class="truncate">· {{ sale.soldByName }}</span>
                    </p>
                  </div>
                  <div class="shrink-0">
                    <a [routerLink]="['/sales', 'sale', sale.id]" class="btn-link">
                      <span class="btn-link-text">Ver más</span>
                      <span class="material-icons text-base">chevron_right</span>
                    </a>
                  </div>
                </div>

                <!-- DESKTOP -->
                <div class="group hidden lg:grid items-center px-4 py-3 transition-colors duration-150 hover:bg-bg-muted"
                  [style.grid-template-columns]="gridCols"
                >
                  <span class="font-mono text-[13px] font-bold text-text-main">
                    #{{ sale.number }}
                  </span>
                  <span class="text-[13px] font-medium text-text-main">{{ sale.createdAt | smartDate }}</span>
                  <span class="text-xs text-text-main font-medium truncate pr-2" [title]="sale.firstItemDisplayName">{{ sale.firstItemDisplayName || '—' }}</span>
                  <span class="flex justify-center">
                    @if (isReturnType(sale.type)) {
                      <span class="text-[11px] font-bold text-feedback-warning-text bg-feedback-warning/15 border border-feedback-warning/30 px-2 py-0.5 rounded-md">Devolución</span>
                    } @else {
                      <span class="text-[11px] font-medium text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md">Venta</span>
                    }
                  </span>
                  <span class="text-center">
                    <span class="text-xs font-bold font-mono text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md">{{ sale.totalDistinctItems }} · {{ sale.totalQuantity }}</span>
                  </span>
                  <span class="text-right text-[13px] font-mono font-bold" [class.text-feedback-warning-text]="isReturnType(sale.type)" [class.text-text-main]="!isReturnType(sale.type)">{{ sale.totalAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                  <span class="text-center">
                    @if (sale.hasReturn) {
                      <span class="text-xs font-bold text-feedback-warning-text bg-feedback-warning/10 px-2 py-0.5 rounded-md">{{ sale.returnedAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                    } @else if (isReturnType(sale.type)) {
                      <span class="text-xs text-text-soft">—</span>
                    } @else {
                      <span class="text-xs text-text-soft">Sin reembolso</span>
                    }
                  </span>
                  <div class="flex justify-end">
                    <a [routerLink]="['/sales', 'sale', sale.id]" class="btn-link">
                      <span class="btn-link-text">Ver más</span>
                      <span class="material-icons text-base">chevron_right</span>
                    </a>
                  </div>
                </div>
              </li>
            }
          </ul>
        </div>
      }

      @if (!loading() && totalItems() > 0) {
        <app-paginator [page]="query().page!" [pageSize]="query().pageSize!" [totalItems]="totalItems()" (pageChange)="onPage($event)" (pageSizeChange)="onPageSize($event)" />
      }
    </div>
  `,
})
export default class SalesListPage implements OnInit {
  private saleService = inject(SaleService);

  SaleType = SaleType;
  protected isReturnType = isReturnType;
  /** Columnas del grid desktop: header y filas comparten esta única fuente. */
  readonly gridCols = '5rem 10rem 1fr 6rem 6rem 7rem 8rem 7rem';

  sales = signal<SaleListDto[]>([]);
  totalItems = signal(0);
  loading = signal(true);
  error = signal<string | null>(null);

  query = signal<SalesQueryDto>({ page: 1, pageSize: 10 });

  hasDateFilter = computed(() => !!(this.query().dateFrom || this.query().dateTo));
  hasActiveFilters = computed(() => this.query().type != null || this.query().hasReturn != null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.saleService.getSales(this.query()).subscribe({
      next: (data: any) => {
        // El backend puede devolver array plano o el wrapper paginado
        const items: SaleListDto[] = Array.isArray(data) ? data : (data?.items ?? []);
        const total: number = Array.isArray(data) ? data.length : (data?.totalCount ?? items.length);
        this.sales.set(items);
        this.totalItems.set(total);
        this.loading.set(false);
      },
      error: (err: any) => { this.loading.set(false); const e = err as { error?: { detail?: string; title?: string }; message?: string }; this.error.set(e?.error?.detail || e?.error?.title || e?.message || 'Error al cargar ventas.'); },
    });
  }

  onDateRange(range: DateRange): void {
    this.query.update((q) => ({ ...q, dateFrom: range.from, dateTo: range.to, page: 1 }));
    this.load();
  }

  setType(type: SaleType | null): void {
    this.query.update((q) => ({ ...q, type, page: 1 }));
    this.load();
  }

  setHasReturn(hasReturn: boolean | null): void {
    this.query.update((q) => ({ ...q, hasReturn, page: 1 }));
    this.load();
  }

  onPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
    this.load();
  }

  onPageSize(pageSize: number): void {
    this.query.update((q) => ({ ...q, pageSize, page: 1 }));
    this.load();
  }

  clearFilters(): void {
    this.query.set({ page: 1, pageSize: this.query().pageSize });
    this.load();
  }
}
