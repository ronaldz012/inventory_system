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
import { VariantFormGroup } from '../common/variant-form-group';
import { ProductSearchResult, ProductVariantOption } from '../../../../components/product-search/product-search-result';
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


  form   = input.required<ItemFormGroup>();
  index  = input<number>(0);
  remove = output<void>();
  create = output<CreateEntityEvent>();

  isNewProduct  = signal(false);
  productSearch = signal('');
  showDropdown  = signal(false);

  availableVariants = signal<ProductVariantOption[]>([]);
  categories        = input.required<Category[]>();
  brands            = input.required<Brand[]>();
  variants = signal<{ mode: 'new' | 'existing', form: VariantFormGroup }[]>([]);
  private variantsValue = signal<any[]>([]);
  selectedProductSignal = signal<ProductSearchResult | null>(null);

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


  ngOnInit(): void {
    this.syncVariantsSignal();
  }


  private syncVariantsSignal(): void {
    this.variantsValue.set(this.variantsArray().value);
    this.variantsArray().valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => this.variantsValue.set(val));
  }


  get productIdCtrl(): FormControl<number | null> { return this.form().controls.productId; }
  get newProductGroup(): FormGroup { return this.form().controls.newProduct; }

  selectProductFromChild(product: ProductSearchResult): void {
    this.selectedProductSignal.set(product)
    this.productIdCtrl.setValue(product.id);
    this.productIdCtrl.markAsTouched();
    this.productSearch.set(product.name);
    this.availableVariants.set(product.productVariants);
    console.log('ESTO SON LAS VARIANTES'+this.availableVariants());
    this.showDropdown.set(false);
    this.resetVariants();
  }

  switchToNewProduct(): void {
    console.log('--- MODO: NUEVO PRODUCTO ---');
    this.isNewProduct.set(true);
    this.productIdCtrl.setValue(null);
    this.productIdCtrl.clearValidators();
    this.productIdCtrl.updateValueAndValidity();
    this.productIdCtrl.markAsPristine();
    this.productIdCtrl.markAsUntouched();
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

    const  np= this.newProductGroup;

    // 2. Limpiar validadores de los campos específicos de "New Product"
    // Si no los quitas, el Form sigue pidiéndolos internamente.
    np.get('name')?.clearValidators();
    np.get('categoryId')?.clearValidators();
    np.get('brandId')?.clearValidators();
    np.get('basePrice')?.clearValidators();
    np.get('gender')?.clearValidators();
    np.reset();
    np.markAsPristine();
    np.markAsUntouched();
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

  onProductSelected(product: ProductSearchResult): void {
    // Guardamos el objeto para que el hijo sepa qué hay seleccionado (input)
    this.selectedProductSignal.set(product);

    // Cargamos las variantes disponibles
    this.availableVariants.set(product.productVariants);

    // Reiniciamos los formularios de variantes
    this.resetVariants();
  }

  onSelectionCleared(): void {
    this.selectedProductSignal.set(null);
    this.availableVariants.set([]);
    this.resetVariants();
  }
 onRemove (): void { this.remove.emit(); }

  handleOpenCreation(event: CreateEntityEvent) {
   this.create.emit(event)
  }
}
