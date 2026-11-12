import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SaleService } from '@features/sales/services/sale-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { SellerDto } from '@features/sales/dtos/seller-dto';
import { SalesStatsDto } from '@features/sales/dtos/sales-stats-dto';
import {
  dayKey,
  dayOf,
  parseStatsQuery,
  rangeForDay,
  SalesStatsQuery,
  sameStatsQuery,
  serializeStatsQuery,
  todayKey,
} from '@features/sales/dtos/sales-stats-query-dto';
import { paymentMethodLabel } from '@features/sales/dtos/sale-detail-dto';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { readQuery, writeQuery } from '@shared/utils/list-query';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Días que se completan si el backend saltea los días sin ventas. */
const MAX_FILLED_DAYS = 366;

/**
 * Tablero de rendimiento: KPIs, ventas por día, medios de pago, corte
 * registradas/libres, ranking de vendedores y más vendidos.
 *
 * Filtro con doble fecha y "Aplicar": una sola navegación y un solo request
 * por ronda (y valida el rango antes de salir). El backend agrega todo; acá
 * no se suman ventas.
 */
@Component({
  selector: 'app-performance-page',
  standalone: true,
  imports: [MoneyPipe, SkeletonList],
  templateUrl: './performance-page.html',
})
export default class PerformancePage implements OnInit {
  private readonly saleService = inject(SaleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly perm = inject(PermissionService);

  stats = signal<SalesStatsDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  sellers = signal<SellerDto[]>([]);

  readonly maxDay = todayKey();

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Filtros aplicados (URL = fuente de verdad). */
  readonly query = computed<SalesStatsQuery>(() => parseStatsQuery(readQuery(this.queryParams())), {
    equal: sameStatsQuery,
  });

  /** Borrador del formulario; `null` = refleja lo aplicado. */
  private readonly draft = signal<SalesStatsQuery | null>(null);
  readonly form = computed<SalesStatsQuery>(() => this.draft() ?? this.query());

  readonly canSeeOthers = computed(() => this.perm.can('sales', 'sales', 'readAll'));
  readonly hasMargin = computed(() => this.stats()?.totals.marginPct != null);

  /** Rango invertido: se avisa y no se deja aplicar. */
  readonly invalidRange = computed(() => {
    const f = this.form();
    return !!f.dateFrom && !!f.dateTo && f.dateFrom > f.dateTo;
  });

  readonly hasPending = computed(() => !sameStatsQuery(this.form(), this.query()));
  readonly canApply = computed(
    () =>
      this.hasPending() && !this.invalidRange() && !!this.form().dateFrom && !!this.form().dateTo,
  );

  readonly isEmpty = computed(() => {
    const t = this.stats()?.totals;
    if (!t) return true;
    return t.salesCount === 0 && t.returnsCount === 0;
  });

  /**
   * Un punto por día del rango, en orden. Los días sin ventas se completan en
   * cero: el gráfico no puede saltearse días ni correrse.
   */
  readonly dayBars = computed(() => {
    const byDate = new Map((this.stats()?.byDay ?? []).map((d) => [d.date, d]));
    const q = this.query();
    const days = this.rangeDays(q.dateFrom, q.dateTo);

    const rows = days.length
      ? days.map((date) => byDate.get(date) ?? { date, salesCount: 0, netSalesAmount: 0 })
      : (this.stats()?.byDay ?? []);

    const max = Math.max(1, ...rows.map((d) => d.netSalesAmount));
    return rows.map((d, i) => {
      const date = new Date(`${d.date}T12:00:00`);
      const label = `${WEEKDAYS[date.getDay()]} ${d.date.slice(8, 10)}`;
      return {
        date: d.date,
        label,
        tooltip: `${label} · Bs ${d.netSalesAmount.toFixed(2)} (${d.salesCount} ventas)`,
        heightPct: d.netSalesAmount > 0 ? Math.max(4, (d.netSalesAmount / max) * 100) : 0,
        showLabel: rows.length <= 10 || i % 5 === 0 || i === rows.length - 1,
      };
    });
  });

  /** Medios de pago con porcentaje sobre el total (el neto puede ser negativo). */
  readonly paymentSplit = computed(() => {
    const rows = this.stats()?.byPaymentMethod ?? [];
    const total = rows.reduce((sum, r) => sum + Math.max(0, r.amount), 0) || 1;
    return rows.map((r) => ({
      method: r.method,
      label: paymentMethodLabel(r.method),
      salesCount: r.salesCount,
      amount: r.amount,
      pct: Math.max(0, Math.round((r.amount / total) * 100)),
    }));
  });

  /**
   * Corte registradas/libres con % sobre el neto. Los ítems solo se muestran
   * si el backend manda `freeUnitsSold` (pendiente); si no, queda el conteo
   * de documentos.
   */
  readonly kindSplit = computed(() => {
    const t = this.stats()?.totals;
    if (!t) return null;

    const net = t.netSalesAmount;
    const pct = (value: number) => (net > 0 ? Math.round((value / net) * 1000) / 10 : 0);
    const freeUnits = t.freeUnitsSold ?? null;

    return {
      hasUnits: freeUnits != null,
      registered: {
        amount: net - t.freeSalesAmount,
        count: t.salesCount - t.freeSalesCount,
        units: freeUnits != null ? t.unitsSold - freeUnits : null,
        pct: pct(net - t.freeSalesAmount),
      },
      free: {
        amount: t.freeSalesAmount,
        count: t.freeSalesCount,
        units: freeUnits,
        pct: pct(t.freeSalesAmount),
      },
    };
  });

  /** El backend manda por variante; acá se agrupa por producto para el ranking. */
  readonly topProducts = computed(() => {
    const rows = this.stats()?.topProducts ?? [];
    const grouped = new Map<
      string,
      { name: string; units: number; amount: number; margin: number; hasCost: boolean }
    >();

    for (const row of rows) {
      const current = grouped.get(row.productName) ?? {
        name: row.productName,
        units: 0,
        amount: 0,
        margin: 0,
        hasCost: false,
      };
      current.units += row.units;
      current.amount += row.netSalesAmount;
      if (row.grossMargin != null) {
        current.margin += row.grossMargin;
        current.hasCost = true;
      }
      grouped.set(row.productName, current);
    }

    return [...grouped.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((p) => ({ ...p, margin: p.hasCost ? p.margin : null }));
  });

  readonly gridCols = computed(() => (this.hasMargin() ? '1fr 4rem 9rem 8rem' : '1fr 4rem 9rem'));

  constructor() {
    effect(() => {
      const query = this.query();
      untracked(() => {
        // La URL manda: si cambió por fuera (atrás/adelante), se descarta el borrador.
        this.draft.set(null);
        this.load(query);
      });
    });
  }

  ngOnInit(): void {
    this.normalizeUrl();
    if (this.canSeeOthers()) this.loadSellers();
  }

  /** Deja la URL explícita: rango resuelto y `soldById` saneado por permisos. */
  private normalizeUrl(): void {
    const raw = readQuery(this.route.snapshot.queryParamMap);
    const query = this.query();
    const hasRange = !!raw['dateFrom'] && !!raw['dateTo'];
    const staleSeller = !!query.soldById && !this.canSeeOthers();
    const clean: SalesStatsQuery = staleSeller ? { ...query, soldById: undefined } : query;

    if (!hasRange || staleSeller) {
      writeQuery(this.router, this.route, serializeStatsQuery(clean));
    }
  }

  load(query: SalesStatsQuery = this.query()): void {
    this.loading.set(true);
    this.error.set(null);
    this.saleService.getSalesStats(query).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.error.set(
          e?.error?.detail || e?.error?.title || e?.message || 'Error al cargar el rendimiento.',
        );
      },
    });
  }

  private loadSellers(): void {
    this.saleService.getSellers().subscribe({
      next: (sellers) => this.sellers.set(sellers ?? []),
      error: () => this.sellers.set([]),
    });
  }

  /** Los datos del formulario salen del rango aplicado hasta que se editan. */
  dayFrom(): string {
    return this.form().dateFrom ? dayOf(this.form().dateFrom) : '';
  }

  dayTo(): string {
    return this.form().dateTo ? dayOf(this.form().dateTo) : '';
  }

  onFromChange(event: Event): void {
    const day = (event.target as HTMLInputElement).value;
    this.draft.set({
      ...this.form(),
      dateFrom: day ? rangeForDay(day).dateFrom : '',
    });
  }

  onToChange(event: Event): void {
    const day = (event.target as HTMLInputElement).value;
    this.draft.set({
      ...this.form(),
      dateTo: day ? rangeForDay(day).dateTo : '',
    });
  }

  onSellerChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.draft.set({ ...this.form(), soldById: value === '' ? undefined : value });
  }

  /** Único punto de salida del formulario: una navegación y un request. */
  applyFilters(): void {
    if (!this.canApply()) return;
    // El borrador se limpia cuando la URL confirma el cambio (efecto), así no
    // parpadean los inputs si la navegación tarda.
    writeQuery(this.router, this.route, serializeStatsQuery(this.form()));
  }

  /** `YYYY-MM-DD` de cada día del rango (tope defensivo para URLs raras). */
  private rangeDays(dateFrom: string, dateTo: string): string[] {
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

    const days: string[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (cursor <= last && days.length < MAX_FILLED_DAYS) {
      days.push(dayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }
}
