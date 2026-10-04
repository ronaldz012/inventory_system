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
import { FormsModule } from '@angular/forms';
import { ProductQueryParams, ProductSortBy } from '../../../dtos/products/product-dto';
import { GENDER_LABELS, GENDER_OPTIONS, Gender } from '../../../interfaces/gender';
import { BrandService } from '@features/inventory/services/brand-service';

/** Filtro activo mostrado como chip (etiqueta + cómo se quita). */
interface FilterChip {
  key: string;
  label: string;
  clear: () => void;
}

type SortValue = 'created_desc' | 'stock_desc' | 'stock_asc';

@Component({
  selector: 'app-product-filter-bar',
  imports: [FormsModule],
  templateUrl: './product-filter-bar.html',
  styles: ``,
})
export class ProductFilterBar implements OnInit {
  params = input.required<ProductQueryParams>();
  change = output<Partial<ProductQueryParams>>();
  /** Limpiar todo (el contenedor decide qué resetea: también la búsqueda). */
  clear = output<void>();

  Gender = Gender;
  ProductSortBy = ProductSortBy;
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
    this.debounceTimer = setTimeout(() => this.emit({ filter: value || undefined, page: 1 }), 350);
  }

  /** Enter = "listo": baja el teclado y aplica la búsqueda inmediatamente. */
  onSearchEnter(event: Event) {
    const searchBox = event.target as HTMLInputElement;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.emit({ filter: searchBox.value || undefined, page: 1 });
    searchBox.blur();
  }

  onSortChange(value: SortValue) {
    switch (value) {
      case 'stock_asc':
        this.emit({ sortBy: ProductSortBy.Stock, sortDescending: false, page: 1 });
        break;
      case 'stock_desc':
        this.emit({ sortBy: ProductSortBy.Stock, sortDescending: true, page: 1 });
        break;
      default:
        this.emit({ sortBy: ProductSortBy.CreatedAt, sortDescending: true, page: 1 });
    }
  }

  onToggleInactive() {
    this.emit({ includeInactive: !this.params().includeInactive || undefined, page: 1 });
  }

  currentSort(): SortValue {
    const p = this.params();
    if (p.sortBy === ProductSortBy.Stock) {
      return p.sortDescending ? 'stock_desc' : 'stock_asc';
    }
    return 'created_desc';
  }

  // ── Menú de orden ────────────────────────────────────────────────────────
  readonly sortOptions: readonly { value: SortValue; label: string }[] = [
    { value: 'created_desc', label: 'Más recientes' },
    { value: 'stock_desc', label: 'Mayor stock' },
    { value: 'stock_asc', label: 'Menor stock' },
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
    this.onSortChange(value);
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

  emit(patch: Partial<ProductQueryParams>) {
    this.change.emit(patch);
  }

  // ── Popover de filtros ───────────────────────────────────────────────────
  filtersOpen = signal(false);
  private filtersTrigger = viewChild<ElementRef<HTMLButtonElement>>('filtersTrigger');

  toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  closeFilters(): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
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
        clear: () => this.emit({ categoryId: undefined, page: 1 }),
      });
    }

    if (p.brandId) {
      const name = this.brands().find((b) => b.id === p.brandId)?.name;
      chips.push({
        key: 'brandId',
        label: `Marca: ${name ?? '—'}`,
        clear: () => this.emit({ brandId: undefined, page: 1 }),
      });
    }

    if (p.gender !== undefined) {
      const label = GENDER_LABELS[p.gender] ?? 'Todos';
      chips.push({
        key: 'gender',
        label: `Género: ${label}`,
        clear: () => this.emit({ gender: undefined, page: 1 }),
      });
    }

    if (p.includeInactive) {
      chips.push({
        key: 'includeInactive',
        label: 'Inactivos',
        clear: () => this.emit({ includeInactive: undefined, page: 1 }),
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
