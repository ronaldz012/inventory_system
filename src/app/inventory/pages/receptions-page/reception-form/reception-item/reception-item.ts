import {
  Component,
  computed,
  inject,
  Injector,
  input,
  OnInit,
  output,
  Signal,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { DecimalPipe } from '@angular/common';

import { VariantFormGroup } from '../common/variant-form-group';
import { ItemFormGroup } from '../common/item-form-group';
import {
  ProductSearchResult,
  ProductVariantOption,
} from '../../../../components/product-search/product-search-result';
import { Category } from '../../../../dtos/categories/category-dto';
import { Brand } from '../../../../dtos/brands/brand-dto';
import { CreateEntityEvent } from '../../../../interfaces/types/create-entity-event';

import VariantExistingRow from './variant-existing-row/variant-existing-row';
import VariantNewRow from './variant-new-row/variant-new-row';
import { ExistingProduct } from './existing-product/existing-product';
import NewProduct from './new-product/new-product';

@Component({
  selector: 'app-reception-item',
  standalone: true,
  imports: [
    VariantExistingRow,
    VariantNewRow,
    ReactiveFormsModule,
    DecimalPipe,
    ExistingProduct,
    NewProduct,
  ],
  templateUrl: './reception-item.html',
})
export default class ReceptionItem implements OnInit {
  private fb = inject(FormBuilder);
  private injector = inject(Injector);

  // ---------------- INPUTS / OUTPUTS ----------------
  form = input.required<ItemFormGroup>();
  index = input.required<number>();
  categories = input.required<Category[]>();
  brands = input.required<Brand[]>();

  remove = output<number>();
  create = output<CreateEntityEvent>();

  // ---------------- STATE ----------------
  selectedProductSignal = signal<ProductSearchResult | null>(null);
  isNewProduct = signal(false);
  availableVariants = signal<ProductVariantOption[]>([]);
  selectedProduct = signal<ProductSearchResult | null>(null);

  // ---------------- FORM GETTERS ----------------
  get vArray() {
    return this.form().controls.variants;
  }

  get productIdCtrl() {
    return this.form().controls.productId;
  }

  get newProductGroup() {
    return this.form().controls.newProduct;
  }

  // ---------------- REACTIVE BRIDGE ----------------
  private formValue!: Signal<any>;

  ngOnInit(): void {
    this.formValue = toSignal(
      this.form().valueChanges.pipe(startWith(this.form().value)),
      { injector: this.injector }
    );
  }

  // ---------------- COMPUTEDS ----------------
  usedIds = computed(() =>
    (this.formValue()?.variants ?? [])
      .map((v: any) => v.productVariantId)
      .filter((id: number | null): id is number => id !== null)
  );

  totalUnits = computed(() =>
    (this.formValue()?.variants ?? []).reduce(
      (acc: number, v: any) => acc + (v.quantityReceived ?? 0),
      0
    )
  );

  itemTotalCost = computed(() =>
    (this.formValue()?.variants ?? []).reduce(
      (acc: number, v: any) =>
        acc + (v.quantityReceived ?? 0) * (v.unitCost ?? 0),
      0
    )
  );

  // ---------------- VARIANTS ----------------
  addVariant(mode:'new' | 'ex'): void {
    this.vArray.push(this.buildVariantGroup(mode));
  }

  removeVariant(i: number): void {
    if (this.vArray.length > 1) {
      this.vArray.removeAt(i);
    }
  }

  switchVariantMode(i: number, mode: 'new' | 'ex'): void {
    const group = this.form().controls.variants.at(i) as VariantFormGroup;
    group.controls.newVariant.reset();
    group.controls.mode.setValue(mode);
    group.get('mode')?.updateValueAndValidity();
    console.log(group.controls.mode.value);
  }

  resetVariants(): void {
    this.vArray.clear();

    // evita glitches de render
    if(this.isNewProduct())
      queueMicrotask(() => this.addVariant('new'));
    else
      queueMicrotask(() => this.addVariant('ex'));

  }

  // ---------------- PRODUCT ----------------
  onProductSelected(product: ProductSearchResult): void {
    this.selectedProduct.set(product);
    this.productIdCtrl.setValue(product.id);
    this.availableVariants.set(product.productVariants);
    this.resetVariants();
  }

  onSelectionCleared(): void {
    this.selectedProduct.set(null);
    this.productIdCtrl.setValue(null);
    this.availableVariants.set([]);
    this.resetVariants();
  }

  switchToNewProduct(): void {
    this.isNewProduct.set(true);
    this.resetVariants();
  }

  switchToExistingProduct(): void {
    this.isNewProduct.set(false);
    this.form().controls.productId.reset()
    this.resetVariants();
  }

  private setNewProductValidators(active: boolean): void {
    const np = this.newProductGroup;

    const fields = ['name', 'categoryId', 'brandId', 'basePrice', 'gender'];

    fields.forEach((f) => {
      const control = np.get(f);
        control?.setValidators([Validators.required]);
        control?.clearValidators();
      control?.updateValueAndValidity();
    });

    if (!active) {
      np.reset();
    }
  }

  private buildVariantGroup(mode : 'ex' | 'new'): VariantFormGroup {
    return this.fb.group({
      productVariantId: [null as number | null],
      mode: [mode],
      newVariant: this.fb.group({
        description: ['', { nonNullable: true }],
        size: ['', { nonNullable: true }],
        color: ['', { nonNullable: true }],
        price: [null as number | null],
      }),

      quantityReceived: [
        null as number | null,
        [Validators.required, Validators.min(1)],
      ],

      unitCost: [
        null as number | null,
        [Validators.required, Validators.min(0.01)],
      ],
    }) as unknown as VariantFormGroup;
  }

  // ---------------- OUTPUTS ----------------
  onRemove(): void {
    this.remove.emit(this.index());
  }

  handleOpenCreation(event: CreateEntityEvent): void {
    this.create.emit(event);
  }
}
