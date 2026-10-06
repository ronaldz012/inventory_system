import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { debounceTime, distinctUntilChanged, finalize, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { applyEach, applyWhen, form, min, required, schema } from '@angular/forms/signals';

import { ProductSearchResult } from '../../../components/product-search/product-search-result.component';

import { ProductService } from '@features/inventory/services/product-service';
import { GENDER_LABELS, Gender } from '@features/inventory/interfaces/gender';
import { existingVariantSchema, ItemForm } from '@features/inventory/models/variant-form.model';
import { blockNonNumericKeys, parseAmountInput } from '@shared/utils/list-query';

@Component({
  selector: 'app-catalogue-item-modal',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './catalogue-item-modal.html',
})
export default class CatalogueItemModal implements OnInit {
  private productService = inject(ProductService);
  private destroyRef = inject(DestroyRef);
  private search$ = new Subject<string>();
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('catalogueSearchInput');

  // ── Inputs ────────────────────────────────────────────────────────────
  mode = input<'add' | 'edit'>('add');
  initialProduct = input<ProductSearchResult | null>(null);
  item = input<ItemForm | null>(null);
  index = input<number | null>(null);
  existingProductIds = input<GUID[]>([]);

  // ── Outputs ───────────────────────────────────────────────────────────
  close = output<void>();
  confirm = output<{ index: number | null; item: ItemForm }>();
  notFound = output<string>();

  // ── Estado UI ─────────────────────────────────────────────────────────
  error = signal<string | null>(null);
  selectedProduct = signal<ProductSearchResult | null>(null);

  // ── Búsqueda por pasos (sin dropdown): paso 1 buscar, paso 2 variantes ──
  searchQuery = signal('');
  searching = signal(false);
  searchResults = signal<ProductSearchResult[]>([]);

  /** Sin producto (y en modo add) se busca; con producto se cargan variantes. */
  showSearchStep = computed(() => this.mode() === 'add' && !this.selectedProduct());

  visibleSearchResults = computed(() => {
    const excluded = new Set(this.mode() === 'add' ? this.existingProductIds() : []);
    return this.searchResults().filter((r) => !excluded.has(r.id));
  });

  showSearchEmpty = computed(
    () =>
      !this.searching() &&
      this.visibleSearchResults().length === 0 &&
      this.searchQuery().trim().length >= 2,
  );

  constructor() {
    afterNextRender(() => {
      if (this.showSearchStep()) this.searchInput()?.nativeElement.focus();
    });

    this.search$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.searchResults.set([]);
            this.searching.set(false);
            return [];
          }
          this.searching.set(true);
          return this.productService
            .searchProduct(q)
            .pipe(finalize(() => this.searching.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => this.searchResults.set(r));
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  /** Enter elige el primer resultado (rápido en desktop). */
  onSearchEnter(): void {
    const first = this.visibleSearchResults()[0];
    if (first) this.selectSearchResult(first);
  }

  selectSearchResult(product: ProductSearchResult): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.onProductSelected(product);
  }

  /** Volver al paso 1 con el buscador limpio y enfocado. */
  changeProduct(): void {
    this.clearProduct();
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  genderLabel(g: Gender | number): string {
    return GENDER_LABELS[g as Gender] ?? '';
  }

  /** Costo único para llenar todas las filas (herramienta, sin modos ni candados). */
  masterCost = signal<number | null>(null);

  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;

  selectedVariants = computed(() =>
    this.itemModel().variants.filter((v) => v.quantityReceived != null),
  );

  totalUnits = computed(() =>
    this.selectedVariants().reduce((sum, v) => sum + (v.quantityReceived ?? 0), 0),
  );

  totalInvestment = computed(() =>
    this.selectedVariants().reduce(
      (sum, v) => sum + (v.quantityReceived ?? 0) * (v.unitCost ?? 0),
      0,
    ),
  );

  totalSales = computed(() =>
    this.selectedVariants().reduce((sum, v) => sum + (v.quantityReceived ?? 0) * (v.price ?? 0), 0),
  );

  expectedProfit = computed(() => this.totalSales() - this.totalInvestment());

  hasSummary = computed(() => this.selectedVariants().length > 0 && this.totalUnits() > 0);

  // ── Form ──────────────────────────────────────────────────────────────
  itemModel = signal<ItemForm>({
    product: {
      id: null,
      internalCode: '',
      productName: '',
      categoryName: '',
      brandName: '',
      genderName: '',
      description: '',
    },
    variants: [],
  });

  itemForm = form(this.itemModel, (s) => {
    required(s.product.id, { message: 'Requerido' });
    applyEach(s.variants, (item) => {
      applyWhen(
        item,
        ({ valueOf }) => valueOf(item.quantityReceived) != null,
        existingVariantSchema,
      );
    });
  });

  // ── Init ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    if (this.mode() === 'edit') {
      const created = this.initialProduct();
      if (created) this.loadProduct(created);
      else if (this.item()) this.initFromEdit(this.item()!);
    } else {
      const initial = this.initialProduct();
      if (initial) this.loadProduct(initial);
    }
  }

  private initFromEdit(editItem: ItemForm): void {
    this.productService.getById(editItem.product.id!).subscribe((result) => {
      if (!result) return;

      const existingMap = new Map(editItem.variants.filter((v) => v.id).map((v) => [v.id, v]));

      this.selectedProduct.set({
        id: result.id,
        name: result.name,
        internalCode: result.internalCode,
        description: result.description,
        basePrice: result.basePrice,
        brandName: result.brandName,
        categoryName: result.categoryName,
        gender: result.gender,
        productVariants: result.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          sizeId: v.sizeId,
          colorId: v.colorId,
          colorName: v.color,
          price: v.price,
        })),
      });

      this.itemModel.set({
        product: {
          id: result.id,
          productName: result.name,
          internalCode: result.internalCode,
          categoryName: result.categoryName,
          brandName: result.brandName,
          genderName: Gender[result.gender],
          description: result.description,
        },
        variants: result.variants.map((v) => {
          const existing = existingMap.get(v.id);
          return {
            mode: 'ex' as const,
            id: v.id,
            sizeId: v.sizeId,
            sizeName: v.size,
            colorId: v.colorId,
            colorCode: '',
            colorName: v.color,
            price: v.price,
            quantityReceived: existing?.quantityReceived ?? null,
            unitCost: existing?.unitCost ?? null,
            sku: v.sku,
          };
        }),
      });
    });
  }

  // ── Producto ──────────────────────────────────────────────────────────
  onProductSelected(product: ProductSearchResult | null): void {
    if (!product) {
      this.clearProduct();
      return;
    }
    this.loadProduct(product);
  }

  private loadProduct(product: ProductSearchResult): void {
    this.selectedProduct.set(product);

    this.itemModel.set({
      product: {
        id: product.id,
        productName: product.name,
        internalCode: product.internalCode,
        categoryName: product.categoryName,
        brandName: product.brandName,
        genderName: Gender[product.gender],
        description: product.description,
      },
      variants: product.productVariants.map((v) => ({
        mode: 'ex' as const,
        id: v.id,
        sizeId: v.sizeId,
        sizeName: v.size,
        colorId: v.colorId,
        colorCode: '',
        colorName: v.colorName,
        price: v.price,
        quantityReceived: null,
        unitCost: null,
        sku: v.sku,
      })),
    });
  }

  private clearProduct(): void {
    this.selectedProduct.set(null);
    this.itemModel.set({
      product: {
        id: null,
        internalCode: '',
        productName: '',
        categoryName: '',
        brandName: '',
        genderName: '',
        description: '',
      },
      variants: [],
    });
  }

  // ── Variantes ─────────────────────────────────────────────────────────
  updateVariantField(index: number, field: 'quantityReceived' | 'unitCost', event: Event): void {
    const cleanValue = parseAmountInput((event.target as HTMLInputElement).value);

    this.itemModel.update((m) => {
      const variants = m.variants.map((v, i) => (i === index ? { ...v, [field]: cleanValue } : v));
      return { ...m, variants };
    });
  }

  /**
   * Cantidad inválida (tocada y con error): gana sobre el accent de "llena".
   */
  qtyInvalid(index: number): boolean {
    const state = this.itemForm.variants[index].quantityReceived();
    return state.touched() && state.invalid();
  }

  onUniqueCostChange(value: string): void {
    this.masterCost.set(parseAmountInput(value));
  }

  /** Escribe el costo único en todas las filas (commit explícito, sin propagación en vivo). */
  applyUniqueCost(): void {
    const cost = this.masterCost();
    if (cost == null) return;
    this.itemModel.update((current) => ({
      ...current,
      variants: current.variants.map((v) => ({ ...v, unitCost: cost })),
    }));
  }

  // ── Submit ────────────────────────────────────────────────────────────
  onConfirm(): void {
    this.itemForm().markAsTouched();

    const enteredVariants = this.itemModel().variants.filter((v) => v.quantityReceived != null);
    if (!enteredVariants.length) {
      this.error.set('Cargá al menos una cantidad.');
      return;
    }

    if (this.mode() === 'add') {
      const productId = this.itemModel().product.id;
      if (productId && this.existingProductIds().includes(productId)) {
        this.error.set('Este producto ya fue agregado a la recepción.');
        return;
      }
    }

    if (this.itemForm().invalid()) return;

    const finalItem: ItemForm = {
      ...this.itemModel(),
      variants: this.itemModel().variants.filter((v) => v.quantityReceived != null),
    };

    this.confirm.emit({ index: this.mode() === 'edit' ? this.index() : null, item: finalItem });
    this.close.emit();
  }

  // ── Navegación ────────────────────────────────────────────────────────
  onClose(): void {
    this.close.emit();
  }
  onNotFound(query: string): void {
    this.notFound.emit(query);
  }
}
