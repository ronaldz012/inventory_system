import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DateRange, DateRangeFilter } from '@shared/components/date-range-filter/date-range-filter';
import { cleanSalesFilter, SalesQueryDto } from '@features/sales/dtos/sales-query-dto';
import {
  SaleReturnStatus,
  SaleType,
  returnStatusLabel,
  returnStatusValue,
} from '@features/sales/dtos/sale-detail-dto';
import {
  QrScannerModal,
  isBarcodeApiAvailable,
} from '@features/sales/components/qr-scanner-modal/qr-scanner-modal';
import { SaleService } from '@features/sales/services/sale-service';
import { SellerDto } from '@features/sales/dtos/seller-dto';

/** Los campos que vive el popover de filtros. */
type FilterDraft = Pick<SalesQueryDto, 'soldById' | 'returnStatus'>;

/**
 * Barra del listado de ventas: búsqueda libre (Nº, SKU o producto) con QR,
 * pestañas Ventas/Devoluciones, fecha y filtros secundarios en popover.
 *
 * El popover trabaja con **borrador**: los selects no navegan, solo editan
 * estado local; recién "Aplicar" emite (una navegación + un request). Así el
 * commit es un click y no depende del `change` de un select nativo, que en
 * desktop no se comporta igual que en mobile.
 *
 * El estado aplicado vive en el padre (URL); esta barra solo emite parches.
 */
@Component({
  selector: 'app-sales-filter-bar',
  standalone: true,
  imports: [DateRangeFilter, QrScannerModal],
  templateUrl: './sales-filter-bar.html',
})
export class SalesFilterBar implements OnInit, OnDestroy {
  params = input.required<SalesQueryDto>();
  change = output<Partial<SalesQueryDto>>();
  /** Limpiar todo (el contenedor decide qué resetea). */
  clear = output<void>();

  readonly SaleType = SaleType;
  readonly returnStatusLabel = returnStatusLabel;
  readonly returnStatusOptions = [
    { value: SaleReturnStatus.None, label: 'Sin devolución' },
    { value: SaleReturnStatus.Partial, label: 'Parcialmente devuelta' },
    { value: SaleReturnStatus.Full, label: 'Devuelta' },
  ];

  private readonly saleService = inject(SaleService);

  searchValue = signal('');
  scannerAvailable = signal(false);
  filtersOpen = signal(false);
  sellers = signal<SellerDto[]>([]);

  /** Borrador del popover. `null` = sin cambios pendientes (muestra lo aplicado). */
  private readonly draft = signal<FilterDraft | null>(null);

  readonly isReturnsView = computed(() => this.params().type === SaleType.Return);
  readonly hasReturnStatusFilter = computed(() => this.params().returnStatus !== undefined);
  readonly hasSellerFilter = computed(() => this.params().soldById !== undefined);
  readonly activeFiltersCount = computed(
    () => (this.hasReturnStatusFilter() ? 1 : 0) + (this.hasSellerFilter() ? 1 : 0),
  );
  readonly hasAnyFilter = computed(() => {
    const p = this.params();
    return !!(
      p.filter ||
      p.dateFrom ||
      p.dateTo ||
      p.returnStatus !== undefined ||
      p.soldById !== undefined
    );
  });

  /** Nombre a mostrar en el chip; si el vendedor no está en la lista, cae a "Vendedor". */
  readonly sellerName = computed(
    () => this.sellers().find((s) => s.id === this.params().soldById)?.name ?? 'Vendedor',
  );

  /** Lo que muestran los controles del popover: borrador o estado aplicado. */
  readonly popover = computed<FilterDraft>(
    () =>
      this.draft() ?? {
        soldById: this.params().soldById,
        returnStatus: this.params().returnStatus,
      },
  );

  /** Hay cambios sin aplicar. */
  readonly hasPending = computed(() => {
    const d = this.popover();
    const p = this.params();
    return d.soldById !== p.soldById || d.returnStatus !== p.returnStatus;
  });

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Último filtro que esta barra empujó al padre (para no pisar lo tipeado). */
  private lastEmitted: string | undefined = undefined;
  private readonly filtersTrigger = viewChild<ElementRef<HTMLButtonElement>>('filtersTrigger');
  private readonly filtersPanel = viewChild<ElementRef<HTMLDivElement>>('filtersPanel');

  constructor() {
    // Adopta el filtro solo cuando la URL cambió por fuera de esta barra
    // (atrás/adelante, "limpiar" del contenedor). Si el valor es el que ya
    // emitimos, se respeta lo que el usuario tiene en el input.
    effect(() => {
      const applied = this.params().filter;
      untracked(() => {
        if (applied === this.lastEmitted) return;
        this.lastEmitted = applied;
        this.cancelDebounce();
        this.searchValue.set(applied ?? '');
      });
    });
  }

  async ngOnInit(): Promise<void> {
    this.loadSellers();
    this.scannerAvailable.set(await isBarcodeApiAvailable());
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  /**
   * Vendedores para el filtro. Si el endpoint falla, el control simplemente no
   * aparece: la lista sigue funcionando.
   */
  private loadSellers(): void {
    this.saleService.getSellers().subscribe({
      next: (sellers) => this.sellers.set(sellers ?? []),
      error: () => this.sellers.set([]),
    });
  }

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  onSearch(value: string): void {
    this.searchValue.set(value);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.emitFilter(value);
    }, 350);
  }

  /** Enter = aplicar ya y bajar el teclado. */
  onSearchEnter(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.cancelDebounce();
    this.emitFilter(input.value);
    input.blur();
  }

  clearSearch(): void {
    this.searchValue.set('');
    this.cancelDebounce();
    this.lastEmitted = undefined;
    this.change.emit({ filter: undefined, page: 1 });
  }

  setType(type: SaleType): void {
    if (type === this.params().type) return;
    this.change.emit({
      type,
      // En devoluciones no existe "estado de devolución".
      returnStatus: type === SaleType.Return ? undefined : this.params().returnStatus,
      page: 1,
    });
  }

  onDateRange(range: DateRange): void {
    this.change.emit({ dateFrom: range.from, dateTo: range.to, page: 1 });
  }

  // ── Popover de filtros (borrador + Aplicar) ──────────────────────────────

  toggleFilters(): void {
    const next = !this.filtersOpen();
    this.filtersOpen.set(next);
    if (!next) return;
    // Al abrir siempre se parte del estado aplicado.
    this.draft.set(null);
    setTimeout(() => this.filtersPanel()?.nativeElement.focus());
  }

  /** Un cambio dentro del popover NO navega: solo edita el borrador. */
  setDraft(patch: FilterDraft): void {
    this.draft.set(patch);
  }

  onSellerChange(soldById: string): void {
    this.setDraft({
      ...this.popover(),
      soldById: soldById === '' ? undefined : soldById,
    });
  }

  onReturnStatusChange(raw: string): void {
    this.setDraft({
      ...this.popover(),
      returnStatus: raw === '' ? undefined : returnStatusValue(Number(raw)),
    });
  }

  /** Único punto de salida del popover: una navegación + un request. */
  applyFilters(): void {
    if (this.hasPending()) {
      const draft = this.popover();
      this.change.emit({
        soldById: draft.soldById,
        returnStatus: draft.returnStatus,
        page: 1,
      });
    }
    this.closeFilters();
  }

  closeFilters(refocus = true): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
    this.draft.set(null);
    if (refocus) setTimeout(() => this.filtersTrigger()?.nativeElement.focus());
  }

  clearReturnStatus(): void {
    this.change.emit({ returnStatus: undefined, page: 1 });
  }

  clearSeller(): void {
    this.change.emit({ soldById: undefined, page: 1 });
  }

  clearAll(): void {
    this.searchValue.set('');
    this.cancelDebounce();
    this.filtersOpen.set(false);
    this.draft.set(null);
    this.clear.emit();
  }

  openScanner(scanner: QrScannerModal): void {
    scanner.open();
  }

  onScanned(code: string): void {
    this.searchValue.set(code);
    this.cancelDebounce();
    this.emitFilter(code);
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) return;
    if (this.filtersOpen() && !target.closest('[data-sales-filters]')) {
      this.closeFilters(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeFilters();
  }

  private cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private emitFilter(value: string): void {
    const filter = cleanSalesFilter(value);
    if (filter === this.params().filter) return;
    this.lastEmitted = filter;
    this.change.emit({ filter, page: 1 });
  }
}
