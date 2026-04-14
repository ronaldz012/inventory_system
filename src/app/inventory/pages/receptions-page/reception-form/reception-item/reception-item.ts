import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { VariantFormGroup } from '../common/variant-form-group';
import { ProductSearchResult, ProductVariantOption } from '../../../../components/product-search/product-search-result';
import { ProductService } from '../../../../services/product-service';
import { CategoryService } from '../../../../services/category-service';
import { BrandService } from '../../../../services/brand-service';
import { Category } from '../../../../interfaces/Dtos/category-dto';
import { Brand } from '../../../../interfaces/Dtos/brand-dto';
import VariantExistingRow from './variant-existing-row/variant-existing-row';
import VariantNewRow from './variant-new-row/variant-new-row';
import {ItemFormGroup} from '../common/item-form-group';
import {ExistingProduct} from './existing-product/existing-product';
import NewProduct from './new-product/new-product';
import {CreateEntityEvent} from '../../../../interfaces/types/create-entity-event';


@Component({
  selector: 'app-reception-item',
  standalone: true,
  imports: [VariantExistingRow, VariantNewRow, ReactiveFormsModule, DecimalPipe, ExistingProduct, ExistingProduct, NewProduct],
  templateUrl: './reception-item.html',
})
export default class ReceptionItem implements OnInit {
  private fb              = inject(FormBuilder);
  private destroyRef      = inject(DestroyRef);
  private productService  = inject(ProductService);


  form   = input.required<ItemFormGroup>();
  index  = input<number>(0);
  remove = output<void>();
  create = output<CreateEntityEvent>();

  isNewProduct  = signal(false);
  productSearch = signal('');
  showDropdown  = signal(false);
  isSearching   = signal(false);
  collapsed     = signal(false);

  searchResults     = signal<ProductSearchResult[]>([]);
  availableVariants = signal<ProductVariantOption[]>([]);
  categories        = input.required<Category[]>();
  brands            = input.required<Brand[]>();
  variants = signal<{ mode: 'new' | 'existing', form: VariantFormGroup }[]>([]);
  private variantsValue = signal<any[]>([]);

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
    if (this.isNewProduct()) return this.newProductGroup.get('name')?.value || 'Producto nuevo';
    return this.productSearch() || 'Seleccioná un producto';
  }

  private searchInput$ = new Subject<string>();

  ngOnInit(): void {
    this.syncVariantsSignal();
    this.setupProductSearch();
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
        next: results => { this.searchResults.set(results); this.isSearching.set(false); },
        error: () => { this.searchResults.set([]); this.isSearching.set(false); },
      });
  }

  get productIdCtrl(): FormControl<number | null> { return this.form().controls.productId; }
  get newProductGroup(): FormGroup { return this.form().controls.newProduct; }

  onSearchInput(value: string) {
    this.productSearch.set(value);

    if (value.trim() === '') {
      this.clearSelection();
    } else {
      this.showDropdown.set(true);
      // IMPORTANTE: Notificar al buscador
      this.searchInput$.next(value);
    }
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

  openDropdown():   void { this.showDropdown.set(true); }
  closeDropdown():  void { setTimeout(() => this.showDropdown.set(false), 150); }
  toggleCollapse(): void { this.collapsed.set(!this.collapsed()); }
  clearSelection() {
    this.productIdCtrl.setValue(null);
    this.productSearch.set('');
    this.resetVariants()
    this.showDropdown.set(false);
  }

  handleBlur() {
    // Retrasamos un poco el cierre para permitir que el click del dropdown funcione
    setTimeout(() => {
      this.showDropdown.set(false);

      // ESCENARIO: El usuario dejó texto pero no seleccionó nada del dropdown
      // o borró parte del nombre de un producto ya seleccionado.
      if (this.productIdCtrl.value === null) {
        // Si no hay ID, no permitimos que quede texto "mentiroso"
        this.clearSelection();
      } else {
        // ESCENARIO: Hay un ID seleccionado, pero el usuario alteró el texto del input
        // Reestablecemos el nombre original del producto seleccionado
        const selectedProduct = this.searchResults().find(p => p.id === this.productIdCtrl.value);
        if (selectedProduct && this.productSearch() !== selectedProduct.name) {
          this.productSearch.set(selectedProduct.name);
        }
      }
    }, 200);
  }

  switchToNewProduct(): void {
    console.log('--- MODO: NUEVO PRODUCTO ---');
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
    np.get('gender')?.setValidators([Validators.required]);
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

  addVariant(): void {
    const mode: 'new' | 'existing' = this.isNewProduct() ? 'new' : 'existing';
    const form = this.buildVariantGroup();

    console.log(`Agregando variante: Modo=${mode}, isNewProduct=${this.isNewProduct()}`);

    this.variantsArray().push(form);

    // Actualizamos la señal
    this.variants.update(v => {
      const newState = [...v, { mode, form }];
      console.log('Nuevo estado de señal variants (length):', newState.length);
      return newState;
    });

    // Log de seguridad para ver si Angular detecta el cambio en el FormArray
    console.log('FormArray actual despues de push:', this.variantsArray().controls.length);
  }

  removeVariant(i: number): void {
    if (this.variants().length === 1) return;
    this.variantsArray().removeAt(i);
    this.variants.update(v => v.filter((_, idx) => idx !== i));
  }

  switchVariantMode(i: number, mode: 'new' | 'existing'): void {
    this.variants.update(v =>
      v.map((item, idx) => idx === i ? { ...item, mode } : item)
    );
  }

  public resetVariants(): void {
    console.log('Antes de clear - FormArray:', this.variantsArray().length, 'Signal:', this.variants().length);

    this.variantsArray().clear();
    this.variants.set([]);

    console.log('Post clear - FormArray:', this.variantsArray().length, 'Signal:', this.variants().length);

    setTimeout(() => {
      this.addVariant();
    }, 0);
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

  onRemove(): void { this.remove.emit(); }

  hasError(ctrl: AbstractControl | null, error = 'required'): boolean {
    return !!(ctrl?.hasError(error) && ctrl.touched);
  }

  handleOpenCreation(event: CreateEntityEvent) {
   this.create.emit(event)
  }
}
