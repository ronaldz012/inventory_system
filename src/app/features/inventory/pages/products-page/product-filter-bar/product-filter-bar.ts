import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CategoryService } from '../../../services/category-service';
import { ProductQueryParams, ProductSortBy } from '../../../dtos/products/product-dto';
import { GENDER_LABELS, GENDER_OPTIONS, Gender } from '../../../interfaces/gender';
import { BrandService } from '@features/inventory/services/brand-service';
import { asNumber } from '@shared/utils/list-query';

/** Filtro activo mostrado como chip (etiqueta + cómo se quita). */
interface FilterChip {
  key: string;
  label: string;
  clear: () => void;
}

type SortValue = 'created_desc' | 'stock_desc' | 'stock_asc';

/** Opción de orden: ya trae el patch que emite (no hay switch separado). */
interface SortOption {
  value: SortValue;
  label: string;
  sortBy: ProductSortBy;
  sortDescending: boolean;
}

@Component({
  selector: 'app-product-filter-bar',
  templateUrl: './product-filter-bar.html',
  styles: ``,
})
export class ProductFilterBar implements OnInit {
  params = input.required<ProductQueryParams>();
  change = output<Partial<ProductQueryParams>>();
  /** Limpiar todo (el contenedor decide qué resetea: también la búsqueda). */
  clear = output<void>();

  readonly genderOptions = GENDER_OPTIONS;

  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);

  protected categories = computed(() => this.categoryService.categories());
  protected brands = computed(() => this.brandService.brands());

  searchValue = signal('');

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Sync searchValue cuando params cambia externamente
    effect(() => this.searchValue.set(this.params().filter ?? ''));
  }

  /** Valor del control que-originó el evento (input o select). */
  valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  /** Valor de un select de género: '' (Todos) → undefined; si no, número. */
  genderFromEvent(event: Event): Gender | undefined {
    const raw = this.valueOf(event);
    return raw === '' ? undefined : asNumber(raw, Gender.Unisex);
  }

  ngOnInit(): void {
    this.categoryService.load();
    this.brandService.load();
  }

  /** No dejar el debounce vivo si la vista se destruye (navegación, etc.). */
  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  onSearch(value: string) {
    this.searchValue.set(value);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(
      () => this.change.emit({ filter: value || undefined, page: 1 }),
      350,
    );
  }

  /** Enter = "listo": baja el teclado y aplica la búsqueda inmediatamente. */
  onSearchEnter(event: Event) {
    const searchBox = event.target as HTMLInputElement;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.change.emit({ filter: searchBox.value || undefined, page: 1 });
    searchBox.blur();
  }

  readonly currentSort = computed<SortValue>(() => {
    const p = this.params();
    if (p.sortBy === ProductSortBy.Stock) {
      return p.sortDescending ? 'stock_desc' : 'stock_asc';
    }
    return 'created_desc';
  });

  // ── Menú de orden ────────────────────────────────────────────────────────
  readonly sortOptions: readonly SortOption[] = [
    {
      value: 'created_desc',
      label: 'Más recientes',
      sortBy: ProductSortBy.CreatedAt,
      sortDescending: true,
    },
    {
      value: 'stock_desc',
      label: 'Mayor stock',
      sortBy: ProductSortBy.Stock,
      sortDescending: true,
    },
    {
      value: 'stock_asc',
      label: 'Menor stock',
      sortBy: ProductSortBy.Stock,
      sortDescending: false,
    },
  ];

  sortMenuOpen = signal(false);
  private sortTrigger = viewChild<ElementRef<HTMLButtonElement>>('sortTrigger');
  private sortOptionEls = viewChildren<ElementRef<HTMLButtonElement>>('sortOption');

  /** Hay orden activo cuando difiere del default ("Más recientes"). */
  readonly sortActive = computed(() => this.currentSort() !== 'created_desc');

  sortText = computed(() => {
    if (!this.sortActive()) return 'Ordenar';
    return this.sortOptions.find((o) => o.value === this.currentSort())?.label ?? 'Ordenar';
  });

  sortIcon = computed(() => {
    switch (this.currentSort()) {
      case 'stock_desc':
        return 'arrow_downward';
      case 'stock_asc':
        return 'arrow_upward';
      default:
        return 'sort';
    }
  });

  sortLabel = computed(() => {
    if (!this.sortActive()) return 'Ordenar productos';
    return `Ordenado por ${this.sortText().toLowerCase()}`;
  });

  toggleSort(): void {
    const next = !this.sortMenuOpen();
    this.sortMenuOpen.set(next);
    if (!next) return;
    const current = this.sortOptions.findIndex((o) => o.value === this.currentSort());
    this.focusSortOption(current < 0 ? 0 : current);
  }

  selectSort(value: SortValue): void {
    const option = this.sortOptions.find((o) => o.value === value);
    if (option)
      this.change.emit({ sortBy: option.sortBy, sortDescending: option.sortDescending, page: 1 });
    this.sortMenuOpen.set(false);
  }

  /** Navegación del menú con teclado (patrón menu / menuitemradio). */
  onSortMenuKeydown(event: KeyboardEvent): void {
    const last = this.sortOptions.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusSortOption(this.nextSortIndex(1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusSortOption(this.nextSortIndex(-1, last));
        break;
      case 'Home':
        event.preventDefault();
        this.focusSortOption(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusSortOption(last);
        break;
      case 'Escape':
        event.preventDefault();
        this.closeSortMenu();
        break;
    }
  }

  private currentSortIndex(): number {
    const focused = this.sortOptionEls().findIndex(
      (el) => el.nativeElement === document.activeElement,
    );
    return focused >= 0
      ? focused
      : this.sortOptions.findIndex((o) => o.value === this.currentSort());
  }

  private nextSortIndex(step: number, last: number): number {
    const current = this.currentSortIndex();
    return current < 0 ? 0 : (current + step + last + 1) % (last + 1);
  }

  private focusSortOption(index: number): void {
    setTimeout(() => this.sortOptionEls()[index]?.nativeElement.focus());
  }

  closeSortMenu(): void {
    if (!this.sortMenuOpen()) return;
    this.sortMenuOpen.set(false);
    this.sortTrigger()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) return;
    if (this.sortMenuOpen() && !target.closest('[data-sort-menu]')) {
      this.sortMenuOpen.set(false);
    }
    if (this.filtersOpen() && !target.closest('[data-filters-menu]')) {
      this.filtersOpen.set(false);
    }
  }

  // ── Popover de filtros ───────────────────────────────────────────────────
  filtersOpen = signal(false);
  private filtersTrigger = viewChild<ElementRef<HTMLButtonElement>>('filtersTrigger');

  /**
   * Los 3 controles del popover escriben en un borrador; recién al pulsar
   * "Aplicar" se emite. Así una ronda de filtros = una navegación + un request
   * (y no tres), y los chips/badge siguen reflejando el estado aplicado.
   * `null` = sin borrador → se muestra el estado aplicado.
   */
  private readonly draft = signal<ProductQueryParams | null>(null);

  readonly popover = computed<ProductQueryParams>(() => this.draft() ?? this.params());

  /** Hay cambios sin aplicar (comparación por campo, como sameProductQuery). */
  readonly hasPending = computed(() => !this.samePopover(this.popover(), this.params()));

  /** Los 3 campos del popover están en su valor por defecto. */
  readonly popoverIsDefault = computed(() => {
    const p = this.popover();
    return !p.categoryId && p.gender === undefined && !p.includeInactive;
  });

  private samePopover(a: ProductQueryParams, b: ProductQueryParams): boolean {
    return (
      a.categoryId === b.categoryId &&
      a.gender === b.gender &&
      a.includeInactive === b.includeInactive
    );
  }

  /** Un cambio dentro del popover NO navega: solo edita el borrador. */
  setDraft(patch: Partial<ProductQueryParams>): void {
    this.draft.update((current) => ({ ...(current ?? this.params()), ...patch }));
  }

  /** Limpiar los 3 campos del popover (tampoco navega). */
  clearDraft(): void {
    this.setDraft({ categoryId: undefined, gender: undefined, includeInactive: undefined });
  }

  /** Único punto de salida del popover: una navegación + un request. */
  applyFilters(): void {
    if (this.hasPending()) {
      const draft = this.popover();
      this.change.emit({
        categoryId: draft.categoryId,
        gender: draft.gender,
        includeInactive: draft.includeInactive,
        page: 1,
      });
    }
    this.draft.set(null);
    this.filtersOpen.set(false);
  }

  toggleFilters(): void {
    const next = !this.filtersOpen();
    this.filtersOpen.set(next);
    // Al abrir siempre se parte del estado aplicado (nada de borradores viejos).
    if (next) this.draft.set(null);
  }

  closeFilters(): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
    this.draft.set(null);
    this.filtersTrigger()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeFilters();
  }

  // ── Chips de filtros activos ─────────────────────────────────────────────
  /**.nota: la marca se busca por texto (filter), el chip solo existe para URLs viejas. */
  readonly activeChips = computed<FilterChip[]>(() => {
    const p = this.params();
    const chips: FilterChip[] = [];

    if (p.categoryId) {
      const name = this.categories().find((c) => c.id === p.categoryId)?.name;
      chips.push({
        key: 'categoryId',
        label: `Categoría: ${name ?? '—'}`,
        clear: () => this.change.emit({ categoryId: undefined, page: 1 }),
      });
    }

    if (p.brandId) {
      const name = this.brands().find((b) => b.id === p.brandId)?.name;
      chips.push({
        key: 'brandId',
        label: `Marca: ${name ?? '—'}`,
        clear: () => this.change.emit({ brandId: undefined, page: 1 }),
      });
    }

    if (p.gender !== undefined) {
      chips.push({
        key: 'gender',
        label: `Género: ${GENDER_LABELS[p.gender]}`,
        clear: () => this.change.emit({ gender: undefined, page: 1 }),
      });
    }

    if (p.includeInactive) {
      chips.push({
        key: 'includeInactive',
        label: 'Inactivos',
        clear: () => this.change.emit({ includeInactive: undefined, page: 1 }),
      });
    }

    return chips;
  });

  clearAll() {
    this.searchValue.set('');
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.filtersOpen.set(false);
    this.clear.emit();
  }
}
