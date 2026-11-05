import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
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

/**
 * Barra del listado de ventas: búsqueda libre (Nº, SKU o producto) con QR,
 * pestañas Ventas/Devoluciones, fecha y filtros secundarios en popover.
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

  searchValue = signal('');
  scannerAvailable = signal(false);
  filtersOpen = signal(false);

  readonly isReturnsView = computed(() => this.params().type === SaleType.Return);
  readonly hasReturnStatusFilter = computed(() => this.params().returnStatus !== undefined);
  readonly hasAnyFilter = computed(() => {
    const p = this.params();
    return !!(p.filter || p.dateFrom || p.dateTo || p.returnStatus !== undefined);
  });

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Último filtro que esta barra empujó al padre (para no pisar lo tipeado). */
  private lastEmitted: string | undefined = undefined;
  private readonly filtersTrigger = viewChild<ElementRef<HTMLButtonElement>>('filtersTrigger');
  private readonly filtersSelect = viewChild<ElementRef<HTMLSelectElement>>('filtersSelect');

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
    this.scannerAvailable.set(await isBarcodeApiAvailable());
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
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

  toggleFilters(): void {
    const next = !this.filtersOpen();
    this.filtersOpen.set(next);
    if (!next) return;
    setTimeout(() => this.filtersSelect()?.nativeElement.focus());
  }

  closeFilters(refocus = false): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
    if (refocus) setTimeout(() => this.filtersTrigger()?.nativeElement.focus());
  }

  onReturnStatusChange(raw: string): void {
    const returnStatus = raw === '' ? undefined : returnStatusValue(Number(raw));
    this.filtersOpen.set(false);
    if (returnStatus === this.params().returnStatus) {
      setTimeout(() => this.filtersTrigger()?.nativeElement.focus());
      return;
    }
    this.change.emit({ returnStatus, page: 1 });
    setTimeout(() => this.filtersTrigger()?.nativeElement.focus());
  }

  clearReturnStatus(): void {
    this.change.emit({ returnStatus: undefined, page: 1 });
  }

  clearAll(): void {
    this.searchValue.set('');
    this.cancelDebounce();
    this.filtersOpen.set(false);
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
      this.filtersOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeFilters(true);
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
