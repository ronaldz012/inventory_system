import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SaleService } from '@features/sales/services/sale-service';
import { SaleListDto } from '@features/sales/dtos/sale-list-dto';
import {
  parseSalesQuery,
  SalesQueryDto,
  sameSalesQuery,
  serializeSalesQuery,
} from '@features/sales/dtos/sales-query-dto';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { Paginator } from '@shared/components/app-paginator/app-paginator';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import {
  SaleReturnStatus,
  SaleType,
  isReturnType,
  returnStatusValue,
} from '@features/sales/dtos/sale-detail-dto';
import { SalesFilterBar } from './sales-filter-bar/sales-filter-bar';
import { readQuery, writeQuery } from '@shared/utils/list-query';

@Component({
  selector: 'app-sales-list-page',
  standalone: true,
  imports: [MoneyPipe, RouterLink, SmartDatePipe, Paginator, SkeletonList, SalesFilterBar],
  styles: `
    @keyframes fade-up {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .row-enter {
      animation: fade-up 200ms ease both;
    }
  `,
  template: `
    <div class="flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-lg font-black text-text-main">
          {{ isReturnsView() ? 'Devoluciones' : 'Ventas' }}
        </h1>

        <div class="flex items-center gap-2 shrink-0">
          <!-- Rendimiento es parte de ventas: se entra con este botón, no con el menú. -->
          <a
            routerLink="/sales/performance"
            [queryParams]="performanceParams()"
            class="btn btn-secondary btn-sm flex items-center gap-1"
          >
            <span class="material-icons text-base leading-none">insights</span>
            Rendimiento
          </a>
        </div>
      </div>

      <app-sales-filter-bar
        [params]="query()"
        (change)="patchQuery($event)"
        (clear)="clearFilters()"
      />

      @if (loading()) {
        <app-skeleton-list [rows]="4" [columns]="3" />
      } @else if (error()) {
        <div
          class="flex flex-col items-center gap-3 p-8 rounded border border-border bg-bg-surface shadow-sm"
        >
          <span class="material-icons text-3xl text-feedback-error-text">error_outline</span>
          <p class="text-sm text-text-main">{{ error() }}</p>
          <button class="btn btn-primary btn-sm" (click)="load()">Reintentar</button>
        </div>
      } @else if (sales().length === 0) {
        <div
          class="flex flex-col items-center justify-center gap-3 py-20 bg-bg-surface border border-dashed border-border rounded-2xl text-text-soft"
        >
          <div
            class="w-16 h-16 rounded-full bg-bg-muted flex items-center justify-center text-text-soft/40"
          >
            <span class="material-icons text-[36px]">receipt</span>
          </div>
          <div class="text-center px-6">
            <p class="font-bold text-text-main text-sm">
              {{ isReturnsView() ? 'Sin devoluciones' : 'Sin ventas' }}
            </p>
            <p class="text-xs max-w-xs mt-1">
              No se encontraron
              {{ isReturnsView() ? 'devoluciones' : 'ventas'
              }}{{ hasActiveFilters() ? ' con los filtros seleccionados' : '' }}.
            </p>
          </div>
          @if (hasActiveFilters()) {
            <button
              class="text-xs font-bold text-accent-ui hover:underline"
              (click)="clearFilters()"
            >
              Limpiar filtros
            </button>
          }
        </div>
      } @else {
        <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div
            class="hidden lg:grid px-4 py-3 bg-bg-muted border-b border-border table-header"
            [style.grid-template-columns]="gridCols"
          >
            <span>Nº</span>
            <span>Fecha</span>
            <span>Producto</span>
            <span class="text-center">Estado</span>
            <span class="text-center">Artículos</span>
            <span class="text-right">Total</span>
            <span class="text-center">Devuelto</span>
            <span></span>
          </div>

          <ul class="flex flex-col divide-y divide-border">
            @for (sale of sales(); track sale.id) {
              <li
                class="group row-enter bg-bg-surface relative overflow-hidden transition-all duration-200 hover:shadow-md"
                [class.border-l-4]="isReturnType(sale.type)"
                [class.border-feedback-warning]="isReturnType(sale.type)"
              >
                <div
                  class="absolute bottom-0 left-0 top-0 w-[4px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 lg:block hidden"
                  [class.bg-accent-ui]="!isReturnType(sale.type)"
                  [class.bg-feedback-warning]="isReturnType(sale.type)"
                ></div>

                <!-- MOBILE -->
                <div class="flex items-center gap-3 px-4 py-3.5 lg:hidden">
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                      <span class="font-mono text-sm font-bold text-text-main">
                        #{{ sale.number }}
                      </span>
                      <span class="text-xs text-text-muted">{{ sale.createdAt | smartDate }}</span>
                      @if (isReturnType(sale.type)) {
                        <span
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30"
                        >
                          Devolución
                        </span>
                      } @else if (sale.returnStatus === SaleReturnStatus.Partial) {
                        <span
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30"
                        >
                          Parcial
                        </span>
                      } @else if (sale.returnStatus === SaleReturnStatus.Full) {
                        <span
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30"
                        >
                          Devuelta
                        </span>
                      }
                    </div>

                    <p
                      class="mt-0.5 truncate text-xs text-text-muted"
                      [title]="sale.firstItemDisplayName"
                    >
                      {{ sale.firstItemDisplayName || '—' }}
                    </p>

                    <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      <span
                        class="font-mono font-bold text-sm"
                        [class.text-feedback-warning-text]="isReturnType(sale.type)"
                        [class.text-text-main]="!isReturnType(sale.type)"
                      >
                        {{ sale.totalAmount | money: 'symbol' }}
                      </span>
                      <span class="text-text-muted">
                        {{ sale.totalDistinctItems }} art. · {{ sale.totalQuantity }} unid.
                      </span>
                      @if (
                        !isReturnType(sale.type) && sale.returnStatus !== SaleReturnStatus.None
                      ) {
                        <span class="font-bold text-feedback-warning-text">
                          Devuelto {{ sale.returnedAmount | money: 'symbol' }}
                        </span>
                      }
                      @if (isReturnType(sale.type) && sale.originalSaleNumber != null) {
                        <span class="text-text-soft">de venta #{{ sale.originalSaleNumber }}</span>
                      }
                    </div>
                  </div>

                  <a
                    [routerLink]="['/sales', 'sale', sale.id]"
                    class="shrink-0 -mr-1 p-1.5 rounded-lg text-text-soft hover:bg-bg-muted hover:text-text-main transition-colors"
                    [attr.aria-label]="
                      'Ver ' +
                      (isReturnType(sale.type) ? 'devolución' : 'venta') +
                      ' #' +
                      sale.number
                    "
                  >
                    <span class="material-icons text-xl leading-none">chevron_right</span>
                  </a>
                </div>

                <!-- DESKTOP -->
                <div
                  class="group hidden lg:grid items-center px-4 py-3 transition-colors duration-150 hover:bg-bg-muted"
                  [style.grid-template-columns]="gridCols"
                >
                  <span class="flex flex-col leading-tight">
                    <span class="font-mono text-[13px] font-bold text-text-main">
                      #{{ sale.number }}
                    </span>
                    @if (isReturnType(sale.type) && sale.originalSaleNumber != null) {
                      <span class="text-[10px] text-text-soft"
                        >de #{{ sale.originalSaleNumber }}</span
                      >
                    }
                  </span>
                  <span class="text-[13px] font-medium text-text-main">
                    {{ sale.createdAt | smartDate }}
                  </span>
                  <span
                    class="text-xs text-text-main font-medium truncate pr-2"
                    [title]="sale.firstItemDisplayName"
                  >
                    {{ sale.firstItemDisplayName || '—' }}
                  </span>
                  <span class="flex justify-center">
                    @if (isReturnType(sale.type)) {
                      <span
                        class="text-[11px] font-bold text-feedback-warning-text bg-feedback-warning/15 border border-feedback-warning/30 px-2 py-0.5 rounded-md"
                      >
                        Devolución
                      </span>
                    } @else if (sale.returnStatus === SaleReturnStatus.Partial) {
                      <span
                        class="text-[11px] font-bold text-feedback-warning-text bg-feedback-warning/15 border border-feedback-warning/30 px-2 py-0.5 rounded-md"
                      >
                        Parcial
                      </span>
                    } @else if (sale.returnStatus === SaleReturnStatus.Full) {
                      <span
                        class="text-[11px] font-bold text-feedback-warning-text bg-feedback-warning/15 border border-feedback-warning/30 px-2 py-0.5 rounded-md"
                      >
                        Devuelta
                      </span>
                    } @else {
                      <span class="text-xs text-text-soft">—</span>
                    }
                  </span>
                  <span class="text-center">
                    <span
                      class="text-xs font-bold font-mono text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md"
                    >
                      {{ sale.totalDistinctItems }} · {{ sale.totalQuantity }}
                    </span>
                  </span>
                  <span
                    class="text-right text-[13px] font-mono font-bold"
                    [class.text-feedback-warning-text]="isReturnType(sale.type)"
                    [class.text-text-main]="!isReturnType(sale.type)"
                  >
                    {{ sale.totalAmount | money: 'symbol' }}
                  </span>
                  <span class="text-center">
                    @if (!isReturnType(sale.type) && sale.returnStatus !== SaleReturnStatus.None) {
                      <span
                        class="text-xs font-bold text-feedback-warning-text bg-feedback-warning/10 px-2 py-0.5 rounded-md"
                      >
                        {{ sale.returnedAmount | money: 'symbol' }}
                      </span>
                    } @else {
                      <span class="text-xs text-text-soft">—</span>
                    }
                  </span>
                  <div class="flex justify-end">
                    <a
                      [routerLink]="['/sales', 'sale', sale.id]"
                      class="-mr-1 p-1.5 rounded-lg text-text-soft hover:bg-bg-muted hover:text-text-main transition-colors"
                      [attr.aria-label]="
                        'Ver ' +
                        (isReturnType(sale.type) ? 'devolución' : 'venta') +
                        ' #' +
                        sale.number
                      "
                    >
                      <span class="material-icons text-xl leading-none">chevron_right</span>
                    </a>
                  </div>
                </div>
              </li>
            }
          </ul>
        </div>
      }

      @if (!loading() && totalItems() > 0) {
        <app-paginator
          [page]="query().page"
          [pageSize]="query().pageSize"
          [totalItems]="totalItems()"
          (pageChange)="patchQuery({ page: $event })"
          (pageSizeChange)="patchQuery({ pageSize: $event, page: 1 })"
        />
      }
    </div>
  `,
})
export default class SalesListPage {
  private readonly saleService = inject(SaleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly SaleType = SaleType;
  readonly SaleReturnStatus = SaleReturnStatus;
  protected readonly isReturnType = isReturnType;

  /** Columnas del grid desktop: header y filas comparten esta única fuente. */
  readonly gridCols = '5rem 10rem 1fr 8rem 6rem 7rem 8rem 3rem';

  sales = signal<SaleListDto[]>([]);
  totalItems = signal(0);
  loading = signal(true);
  error = signal<string | null>(null);

  /** Estado de la lista derivado de la URL: refresh y "atrás" lo restauran. */
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly query = computed<SalesQueryDto>(() => parseSalesQuery(readQuery(this.queryParams())), {
    equal: sameSalesQuery,
  });

  readonly isReturnsView = computed(() => this.query().type === SaleType.Return);

  /** Lleva el rango y el vendedor activos al tablero, si están definidos. */
  readonly performanceParams = computed<Record<string, string>>(() => {
    const q = this.query();
    const params: Record<string, string> = {};
    if (q.dateFrom && q.dateTo) {
      params['dateFrom'] = q.dateFrom;
      params['dateTo'] = q.dateTo;
    }
    if (q.soldById) params['soldById'] = q.soldById;
    return params;
  });

  readonly hasActiveFilters = computed(() => {
    const q = this.query();
    return !!(
      q.filter ||
      q.dateFrom ||
      q.dateTo ||
      q.returnStatus !== undefined ||
      q.soldById !== undefined
    );
  });

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.load(q));
    });
  }

  load(q: SalesQueryDto = this.query()): void {
    this.loading.set(true);
    this.error.set(null);
    this.saleService.getSales(q).subscribe({
      next: (data) => {
        this.sales.set(
          (data.items ?? []).map((sale) => ({
            ...sale,
            // Tolerante a enum serializado como string ("Partial"/"Full").
            returnStatus: returnStatusValue(sale.returnStatus),
          })),
        );
        this.totalItems.set(data.totalCount ?? 0);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.error.set(
          e?.error?.detail || e?.error?.title || e?.message || 'Error al cargar ventas.',
        );
      },
    });
  }

  patchQuery(patch: Partial<SalesQueryDto>): void {
    writeQuery(this.router, this.route, serializeSalesQuery({ ...this.query(), ...patch }));
  }

  /** Limpia búsqueda, fecha y estado; conserva la pestaña activa. */
  clearFilters(): void {
    this.patchQuery({
      filter: undefined,
      soldById: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      returnStatus: undefined,
      page: 1,
    });
  }
}
