import {Component, computed, DestroyRef, inject, input, OnInit, output, signal,} from '@angular/core';
import {AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators,} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { VariantFormGroup } from '../common/variant-form-group';
import { ProductSearchResult, ProductVariantOption } from '../../../../models/products/product-search-result';
import { ProductService } from '../../../../services/product-service';
import { CategoryService } from '../../../../services/category-service';
import { BrandService } from '../../../../services/brand-service';
import { Category } from '../../../../interfaces/Dtos/category-dto';
import { Brand } from '../../../../interfaces/Dtos/brand-dto';
import ReceptionVariant from './reception-variant/reception-variant';
import {ItemFormGroup} from '../common/item-form-group';

@Component({
  selector: 'app-reception-item',
  standalone: true,
  imports: [ReceptionVariant, ReactiveFormsModule, DecimalPipe],
  templateUrl: './reception-item.html',
})
export default class ReceptionItem implements OnInit {
  // —— Dependencies ——————————————————————————————————————————————————————
  private fb              = inject(FormBuilder);
  private destroyRef      = inject(DestroyRef);
  private productService  = inject(ProductService);
  private categoryService = inject(CategoryService);
  private brandService    = inject(BrandService);

  // —— Inputs / Outputs ——————————————————————————————————————————————————
  form  = input.required<ItemFormGroup>();
  index = input<number>(0);
  remove = output<void>();

  // —— Estado UI —————————————————————————————————————————————————————————
  isNewProduct  = signal(false);
  productSearch = signal('');
  showDropdown  = signal(false);
  isSearching   = signal(false);
  collapsed     = signal(false);

  // —— Datos remotos —————————————————————————————————————————————————————
  searchResults     = signal<ProductSearchResult[]>([]);
  availableVariants = signal<ProductVariantOption[]>([]);
  categories        = signal<Category[]>([]);
  brands            = signal<Brand[]>([]);

  // —— Puente reactivo para el FormArray —————————————————————————————————
  // Necesario para que los computed lean el valor del array reactivamente,
  // ya que los inputs() no pueden usarse en la raíz de la clase.
  private variantsValue = signal<any[]>([]);

  // —— Computados ————————————————————————————————————————————————————————
  variantsArray = computed(() => this.form().controls.variants);

  usedIds = computed(() =>
    this.variantsValue()
      .map(v => v.productVariantId)
      .filter((id): id is number => id !== null && id !== undefined)
  );

  totalUnits = computed(() =>
    this.variantsValue().reduce((acc, v) => acc + (v.quantityReceived ?? 0), 0)
  );

  itemTotalCost = computed(() =>
    this.variantsValue().reduce((acc, v) =>
      acc + (v.quantityReceived ?? 0) * (v.unitCost ?? 0), 0
    )
  );

  get summaryLabel(): string {
    if (this.isNewProduct()) {
      return this.newProductGroup.get('name')?.value || 'Producto nuevo';
    }
    return this.productSearch() || 'Seleccioná un producto';
  }

  // —— Search subject ————————————————————————————————————————————————————
  private searchInput$ = new Subject<string>();

  // —— Lifecycle —————————————————————————————————————————————————————————
  ngOnInit(): void {
    this.loadCatalogs();
    this.syncVariantsSignal();
    this.setupProductSearch();
  }

  private loadCatalogs(): void {
    this.categoryService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.categories.set(x));

    this.brandService.GetAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.brands.set(x));
  }

  private syncVariantsSignal(): void {
    this.variantsValue.set(this.variantsArray().value);
    this.variantsArray().valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => this.variantsValue.set(val));
  }

  private setupProductSearch(): void {
    this.searchInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap(q => {
          if (!q || q.length < 2) {
            this.searchResults.set([]);
            this.isSearching.set(false);
            return [];
          }
          this.isSearching.set(true);
          return this.productService.searchProduct(q);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: results => {
          this.searchResults.set(results);
          this.isSearching.set(false);
        },
        error: () => {
          this.searchResults.set([]);
          this.isSearching.set(false);
        },
      });
  }

  // —— Accessors —————————————————————————————————————————————————————————
  get productIdCtrl(): FormControl<number | null> {
    return this.form().controls.productId;
  }

  get newProductGroup(): FormGroup {
    return this.form().controls.newProduct;
  }

  // —— Búsqueda de producto ——————————————————————————————————————————————
  onSearchInput(value: string): void {
    this.productSearch.set(value);
    if (!value) this.clearProductSelection();
    this.searchInput$.next(value);
  }

  selectProduct(product: ProductSearchResult): void {
    this.productIdCtrl.setValue(product.id);
    this.productIdCtrl.markAsTouched();
    this.productSearch.set(product.name);
    this.availableVariants.set(product.productVariants ?? []);
    this.showDropdown.set(false);
    this.resetVariants();
  }

  clearProductSelection(): void {
    this.productIdCtrl.setValue(null);
    this.availableVariants.set([]);
  }

  openDropdown():  void { this.showDropdown.set(true); }
  closeDropdown(): void { setTimeout(() => this.showDropdown.set(false), 150); }
  toggleCollapse(): void { this.collapsed.set(!this.collapsed()); }

  // —— Toggle modo producto ——————————————————————————————————————————————
  switchToNewProduct(): void {
    this.isNewProduct.set(true);
    this.productIdCtrl.setValue(null);
    this.productIdCtrl.clearValidators();
    this.productIdCtrl.updateValueAndValidity();
    this.productSearch.set('');
    this.availableVariants.set([]);

    const np = this.newProductGroup;
    np.get('name')?.setValidators([Validators.required]);
    np.get('categoryId')?.setValidators([Validators.required]);
    np.get('brandId')?.setValidators([Validators.required]);
    np.get('basePrice')?.setValidators([Validators.required]);
    np.updateValueAndValidity();

    this.resetVariants();
  }

  switchToExistingProduct(): void {
    this.isNewProduct.set(false);
    this.newProductGroup.reset();
    this.productIdCtrl.setValidators([Validators.required]);
    this.productIdCtrl.updateValueAndValidity();
    this.resetVariants();
  }

  // —— Gestión de variantes ——————————————————————————————————————————————
  addVariant(): void {
    const control = this.form().controls.variants;
    control.push(this.buildVariantGroup());
    this.variantsValue.set([...control.value]);
  }

  removeVariant(i: number): void {
    const control = this.form().controls.variants;
    control.removeAt(i);
    this.variantsValue.set([...control.value]);
  }

  private resetVariants(): void {
    const control = this.form().controls.variants;
    control.clear();
    this.addVariant();
  }

  private buildVariantGroup(): VariantFormGroup {
    return this.fb.group({
      productVariantId: [null as number | null],
      newVariant: this.fb.group({
        description: ['', { nonNullable: true }],
        size:        ['', { nonNullable: true }],
        color:       ['', { nonNullable: true }],
        price:       [null as number | null],
      }),
      quantityReceived: [null as number | null, [Validators.required, Validators.min(1)]],
      unitCost:         [null as number | null, [Validators.required, Validators.min(0.01)]],
    }) as unknown as VariantFormGroup;
  }

  // —— Helpers ———————————————————————————————————————————————————————————
  onRemove(): void { this.remove.emit(); }

  hasError(ctrl: AbstractControl | null, error = 'required'): boolean {
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }
}
