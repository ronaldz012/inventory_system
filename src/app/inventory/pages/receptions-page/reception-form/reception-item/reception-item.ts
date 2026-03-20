import {Component, inject, input, OnInit, output, signal} from '@angular/core';
import {VariantFormGroup} from '../common/variant-form-group';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {ProductSearchResult, ProductVariantOption} from '../../../../models/products/product-search-result';
import {ProductService} from '../../../../services/product-service';
import {debounceTime, distinctUntilChanged, Subject, switchMap} from 'rxjs';
import {ItemFormGroup} from '../common/item-form-group';
import ReceptionVariant from './reception-variant/reception-variant';
import {ProductForm} from '../../../products-page/product-form/product-form';
import {Category} from '../../../../interfaces/Dtos/category-dto';
import {Brand} from '../../../../interfaces/Dtos/brand-dto';
import {CategoryService} from '../../../../services/category-service';
import {BrandService} from '../../../../services/brand-service';

@Component({
  selector: 'app-reception-item',
  imports: [
    ReceptionVariant,
    ReactiveFormsModule,
    ProductForm
  ],
  templateUrl: './reception-item.html',
  styles: ``,
})
export default class ReceptionItem implements OnInit {
  // ── Dependencies ──────────────────────────────────────────────────────────
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);

  // ── Inputs ────────────────────────────────────────────────────────────────
  form = input.required<ItemFormGroup>();
  collapsed = signal(false);
  index = input<number>(0);

  brands = signal<Brand[]>([])
  categories = signal<Category[]>([])

  // ── Outputs ───────────────────────────────────────────────────────────────
  remove = output<void>();
  // ── Estado local ──────────────────────────────────────────────────────────
  isNewProduct = signal(false);
  productSearch = signal('');
  showDropdown = signal(false);
  isSearching = signal(false);
  searchResults = signal<ProductSearchResult[]>([]);

  /** Variantes del producto seleccionado, se pasan a cada ReceptionVariant */
  availableVariants = signal<ProductVariantOption[]>([]);

  /** Subject para debounce de búsqueda */
  private searchInput$ = new Subject<string>();

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.brandService.GetAll().subscribe(x => this.brands.set(x))
   this.categoryService.getAll().subscribe(x => this.categories.set(x))
    this.searchInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q || q.length < 2) {
            this.searchResults.set([]);
            this.isSearching.set(false);
            return [];
          }
          this.isSearching.set(true);
          return this.productService.searchProduct(q);
        })
      )
      .subscribe({
        next: (results) => {
          this.searchResults.set(results);
          this.isSearching.set(false);
        },
        error: () => {
          this.searchResults.set([]);
          this.isSearching.set(false);
        },
      });
  }

  // ── Accessors del form ────────────────────────────────────────────────────
  get productIdCtrl(): FormControl<number | null> {
    return this.form().controls.productId;
  }

  get newProductGroup(): FormGroup {
    return this.form().controls.newProduct;
  }

  get variantsArray(): FormArray<VariantFormGroup> {
    return this.form().controls.variants;
  }

  // ── Búsqueda de producto ──────────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.productSearch.set(value);
    // Si el usuario borra el campo, limpiar selección
    if (!value) this.clearProductSelection();
    this.searchInput$.next(value);
  }

  selectProduct(product: ProductSearchResult): void {
    this.productIdCtrl.setValue(product.id);
    this.productIdCtrl.markAsTouched();
    this.productSearch.set(product.name);
    this.availableVariants.set(product.productVariants ?? []);
    this.showDropdown.set(false);
  }

  clearProductSelection(): void {
    this.productIdCtrl.setValue(null);
    this.availableVariants.set([]);
  }

  openDropdown(): void {
    this.showDropdown.set(true);
  }

  closeDropdown(): void {
    setTimeout(() => this.showDropdown.set(false), 150);
  }

  // ── Toggle nuevo / existente ──────────────────────────────────────────────
  switchToNewProduct(): void {
    this.isNewProduct.set(true);
    this.productIdCtrl.setValue(null);
    this.productIdCtrl.clearValidators();
    this.productIdCtrl.updateValueAndValidity();
    this.productSearch.set('');
    this.availableVariants.set([]);
    // Activar validadores de newProduct
    this.newProductGroup.get('name')?.setValidators([Validators.required]);
    this.newProductGroup.get('categoryId')?.setValidators([Validators.required]);
    this.newProductGroup.get('brandId')?.setValidators([Validators.required]);
    this.newProductGroup.get('basePrice')?.setValidators([Validators.required]);
    this.newProductGroup.updateValueAndValidity();
    // Limpiar variantes existentes y agregar una nueva
    this.clearVariants();
    this.addVariant();
  }

  switchToExistingProduct(): void {
    this.isNewProduct.set(false);
    this.newProductGroup.reset();
    this.newProductGroup.get('name')?.clearValidators();
    this.newProductGroup.get('categoryId')?.clearValidators();
    this.newProductGroup.get('brandId')?.clearValidators();
    this.newProductGroup.get('basePrice')?.clearValidators();
    this.newProductGroup.updateValueAndValidity();
    this.productIdCtrl.setValidators([Validators.required]);
    this.productIdCtrl.updateValueAndValidity();
    this.clearVariants();
    this.addVariant();
  }

  // ── Gestión de variantes ──────────────────────────────────────────────────
  addVariant(): void {
    this.variantsArray.push(this.buildVariantGroup());
  }

  removeVariant(i: number): void {
    if (this.variantsArray.length === 1) return; // Al menos una variante
    this.variantsArray.removeAt(i);
  }

  private clearVariants(): void {
    while (this.variantsArray.length > 0) {
      this.variantsArray.removeAt(0);
    }
  }

  private buildVariantGroup(): VariantFormGroup {
    return this.fb.group<VariantFormGroup['controls']>({
      productVariantId: this.fb.control<number | null>(null),
      newVariant: this.fb.group({
        description: this.fb.control('', { nonNullable: true }),
        size: this.fb.control('', { nonNullable: true }),
        color: this.fb.control('', { nonNullable: true }),
        price: this.fb.control<number | null>(null),
      }),

      quantityReceived: this.fb.control<number | null>(null, {
        validators: [Validators.required, Validators.min(1)]
      }),
      unitCost: this.fb.control<number | null>(null, {
        validators: [Validators.required, Validators.min(0.01)]
      }),
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────
  get summaryLabel(): string {
    if (this.isNewProduct()) {
      const name = this.form().controls.newProduct.get('name')?.value;
      return name || 'Producto nuevo';
    }
    return this.productSearch() || 'Seleccioná un producto';
  }
  toggleCollapse(): void {
    this.collapsed.set(!this.collapsed());
  }
  onRemove(): void {
    this.remove.emit();
  }

  hasError(ctrl: AbstractControl | null, error: string = 'required'): boolean {
    if (!ctrl) return false;
    return ctrl.hasError(error) && ctrl.touched;
  }
}

