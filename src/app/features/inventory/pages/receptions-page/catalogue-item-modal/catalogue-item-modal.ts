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
import AddVariantModal from '../../products-page/product-detail/product-detail-variant/add-variant-modal';
import { GridNavDirective } from '@shared/directives/grid-nav.directive';

import { ProductService } from '@features/inventory/services/product-service';
import { SizeService } from '@features/inventory/services/size-service';
import { GENDER_LABELS, Gender } from '@features/inventory/interfaces/gender';
import {
  existingVariantSchema,
  ItemForm,
  VariantForm,
} from '@features/inventory/models/variant-form.model';
import { CreateProductVariantDto } from '@features/inventory/dtos/products/create-product-variant-dto';
import { blockNonNumericKeys, parseAmountInput } from '@shared/utils/list-query';

/** Réplica del orden backend (Color.Name, Size.SortOrder). Sort estable. */
function sortVariants(rows: VariantForm[]): VariantForm[] {
  return rows.sort(
    (a, b) => a.colorName.localeCompare(b.colorName, 'es') || a.sizeOrder - b.sizeOrder,
  );
}

@Component({
  selector: 'app-catalogue-item-modal',
  standalone: true,
  imports: [CurrencyPipe, AddVariantModal, GridNavDirective],
  templateUrl: './catalogue-item-modal.html',
})
export default class CatalogueItemModal implements OnInit {
  private productService = inject(ProductService);
  private sizeService = inject(SizeService);
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

  /** Modal anidado para crear una variante nueva sin salir del panel. */
  showAddVariant = signal(false);
  addVariantSaving = signal(false);

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
    // Catálogo de tallas para resolver el sizeOrder de una variante recién
    // creada cuando el POST no lo incluye (lookup local, cached).
    this.sizeService.load();
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
          sizeOrder: v.sizeOrder ?? 0,
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
            sizeOrder: v.sizeOrder ?? 0,
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
          sizeOrder: v.sizeOrder ?? 0,
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
    const cost = parseAmountInput(value);
    this.masterCost.set(cost);
    // En vivo, pero con guarda: vacío/inválido no toca las filas (no borra
    // costos cargados uno por uno al limpiar el campo).
    if (cost == null) return;
    this.itemModel.update((current) => ({
      ...current,
      variants: current.variants.map((v) => ({ ...v, unitCost: cost })),
    }));
  }

  // ── Crear variante (sin refetch) ────────────────────────────────────
  /**
   * Crea la variante en backend y la encaja en su lugar (color, talla) sin
   * refetch: las filas existentes conservan identidad y lo tipeado intacto.
   */
  onSaveAddVariant(dto: CreateProductVariantDto): void {
    const productId = this.itemModel().product.id;
    if (!productId || this.addVariantSaving()) return;

    this.addVariantSaving.set(true);
    this.productService.createVariants(productId, { variants: [dto] }).subscribe({
      next: (created) => {
        this.addVariantSaving.set(false);
        const first = created[0];
        if (!first) {
          this.error.set('El backend no devolvió la variante creada.');
          return;
        }
        const row: VariantForm = {
          mode: 'ex',
          id: first.productVariantId,
          sizeId: dto.sizeId,
          sizeName: first.size,
          sizeOrder: first.sizeOrder ?? this.lookupSizeOrder(dto.sizeId),
          colorId: dto.colorId,
          colorCode: '',
          colorName: first.colorName,
          price: dto.price,
          quantityReceived: null,
          unitCost: this.masterCost() ?? null,
          sku: first.sku,
        };
        this.itemModel.update((m) => ({ ...m, variants: sortVariants([...m.variants, row]) }));
        this.showAddVariant.set(false);
      },
      error: () => {
        this.addVariantSaving.set(false);
        this.error.set('No se pudo crear la variante. Intentá de nuevo.');
      },
    });
  }

  /** SizeOrder desde el catálogo local (fallback si el POST no lo trae). */
  private lookupSizeOrder(sizeId: GUID): number {
    return this.sizeService.sizes().find((s) => s.id === sizeId)?.sortOrder ?? 0;
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
