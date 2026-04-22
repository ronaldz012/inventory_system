import {
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  DestroyRef,
  ViewChild,
  viewChild,
  effect
} from '@angular/core';
import {FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {ReceptionService} from '../../../services/reception-service';
import {ItemFormGroup, NewProductFormGroup, NewReceptionForm} from './common/item-form-group';
import {VariantFormGroup} from './common/variant-form-group';
import createReceptionDto, {
  Item,
  NewProduct,
  NewVariant
} from '../../../dtos/Receptions/create-reception-dto';
import ReceptionItem from './reception-item/reception-item';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DecimalPipe} from '@angular/common';
import {CategoryService} from '../../../services/category-service';
import {BrandService} from '../../../services/brand-service';
import {Category} from '../../../dtos/categories/category-dto';
import {Brand} from '../../../dtos/brands/brand-dto';
import {CreateCategory} from '../../../components/create-category/create-category';
import {CreateEntityEvent} from '../../../interfaces/types/create-entity-event';
import CreateBrand from '../../../components/create-brand/create-brand';


@Component({
  selector: 'app-reception-form',
  imports: [
    ReactiveFormsModule,
    ReceptionItem,
    DecimalPipe,
    ReceptionItem,
    CreateCategory,
    CreateBrand,
  ],
  templateUrl: './reception-form.html',
  styles: ``,
})
export default class ReceptionForm implements OnInit {
  // ── Dependencies ──────────────────────────────────────────────────────────
  private fb = inject(FormBuilder);
  private receptionService = inject(ReceptionService);
  private destroyRef = inject(DestroyRef);
  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);

  // ── Inputs ────────────────────────────────────────────────────────────────
  branchId = input<number>(1);

  // ── Outputs ───────────────────────────────────────────────────────────────
  saved = output<void>();
  cancelled = output<void>();

  // ── Estates ────────────────────────────────────────────────────────────────
  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  totalCost = signal<number>(0);
  activeModal = signal<CreateEntityEvent | null>(null);
  //────DATA─────────────────────────────────────────────────────────────────────────────
  categories = signal<Category[]>([])
  brands = signal<Brand[]>([])
  categoryModal = viewChild(CreateCategory);
  brandModal = viewChild(CreateBrand);
  lastFocusedElement: HTMLElement | null = null;
  // ── Form ──────────────────────────────────────────────────────────────────
  form: NewReceptionForm = this.fb.group<NewReceptionForm['controls']>({
    notes: this.fb.control('', { nonNullable: true }),
    items: this.fb.array<ItemFormGroup>([]),
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const modal = this.activeModal();
      const modalRefCategory = this.categoryModal();
      const modalRefBrand = this.brandModal();

      if (modal?.type === 'category' && modalRefCategory) {
        setTimeout(() => {
          modalRefCategory.focus(); // 🔥 foco automático
        });
      }
      if(modal?.type === 'brand' && modalRefBrand) {
        setTimeout(() => {
          modalRefBrand.focus();
        })
      }
    });
  }
  ngOnInit(): void {
    this.loadCatalogs();
    this.itemsArray.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculateTotalCost());
  }
  private loadCatalogs(): void {
    this.categoryService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.categories.set(x));
    this.brandService.GetAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(x => this.brands.set(x));
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  private recalculateTotalCost(): void {
    let total = 0;
    for (const itemCtrl of this.itemsArray.controls) {
      for (const varCtrl of itemCtrl.controls.variants.controls) {
        const qty  = varCtrl.controls.quantityReceived.value ?? 0;
        const cost = varCtrl.controls.unitCost.value ?? 0;
        total += qty * cost;
      }
    }
    this.totalCost.set(total);
  }

  // ── Accessors ─────────────────────────────────────────────────────────────
  get notesCtrl(): FormControl {
    return this.form.controls.notes;
  }

  get itemsArray(): FormArray<ItemFormGroup> {
    return this.form.controls.items;
  }

  // ── Gestión de items ──────────────────────────────────────────────────────
  addItem(): void {
    const newItem = this.buildItemGroup();
    this.itemsArray.push(newItem);
    const variantsArray = newItem.get('variants') as FormArray;
    console.log('Cantidad de variantes en el nuevo item:', variantsArray.length);
  }

  removeItem(i: number): void {
    if (this.itemsArray.length === 1) return;
    console.log('deleting: ',i+1);
    this.itemsArray.removeAt(i);
  }

  private buildItemGroup(): ItemFormGroup {
    return this.fb.group<ItemFormGroup['controls']>({
      productId: this.fb.control<number | null>(null, { validators: [Validators.required] }),
      newProduct: this.fb.group<NewProductFormGroup['controls']>({
        name: this.fb.control('', { nonNullable: true }),
        description: this.fb.control('', { nonNullable: true }),
        categoryId: this.fb.control<number | null>(null),
        brandId: this.fb.control<number | null>(null),
        gender: this.fb.control<number | null>(null),
        basePrice: this.fb.control<number>(0, { nonNullable: true }),
      }),
      variants: this.fb.array<VariantFormGroup>([this.buildVariantGroup('new')]),
    });
  }

  private buildVariantGroup(mode: 'ex' | 'new'): VariantFormGroup {
    return this.fb.group({
      productVariantId: this.fb.control<number | null>(null),
      mode: this.fb.control<string>(mode),
      newVariant: this.fb.group({
        description: this.fb.control('', { nonNullable: true }),
        size: this.fb.control('', { nonNullable: true }),
        color: this.fb.control('', { nonNullable: true }),
        price: this.fb.control<number | null>(null),
      }),
      quantityReceived: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(1),
      ]),
      unitCost: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.5),
      ]),
    }) as VariantFormGroup;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  onSubmit(): void {
    this.form.markAllAsTouched();

    const getFormErrors = (formGroup: any) => {
      Object.keys(formGroup.controls).forEach(key => {
        const control = formGroup.get(key);
        if (control.invalid) {
          if (control.controls) getFormErrors(control);
          else console.error(`Campo inválido: ${key}`, control.errors);
        }
      });
      if (formGroup.errors) console.error(`Error en el objeto raíz/grupo:`, formGroup.errors);
    };

    getFormErrors(this.form);

    if (this.form.invalid || this.itemsArray.length === 0) return;

    const payload = this.buildPayload();

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.receptionService.create(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.submitError.set('Error al guardar la recepción. Intentá de nuevo.');
        console.error(err);
      },
    });
  }

  private buildPayload(): createReceptionDto {
    const raw = this.form.getRawValue();

    return {
      branchId: this.branchId(),
      notes: raw.notes,
      items: this.itemsArray.controls.map((itemCtrl) => {
        const item = itemCtrl.getRawValue();
        const isNewProduct = !item.productId;

        return {
          productId: isNewProduct ? null : item.productId,
          newProduct: isNewProduct
            ? ({
              name: item.newProduct.name,
              description: item.newProduct.description,
              categoryId: item.newProduct.categoryId,
              brandId: item.newProduct.brandId,
              basePrice:item.newProduct.basePrice,
              gender : item.newProduct.gender,

            } as NewProduct)
            : null,
          variants: itemCtrl.controls.variants.controls.map((varCtrl) => {
            const variant = varCtrl.getRawValue();
            const isNewVariant = !variant.productVariantId;

            return {
              productVariantId: isNewVariant ? null : variant.productVariantId,
              quantityReceived: variant.quantityReceived,
              unitCost: variant.unitCost,
              newVariant: isNewVariant
                ? ({
                  description: variant.newVariant.description,
                  size: variant.newVariant.size,
                  color: variant.newVariant.color,
                  price: variant.newVariant.price,
                  productId: item.productId ?? 0,
                } as NewVariant)
                : null,
            };
          }),
        } as Item;
      }),
    };
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  //----------------MODALS----------------------------------------------------------
  handleOpenCreation(event: CreateEntityEvent) {
    this.lastFocusedElement = document.activeElement as HTMLElement; // 🔥 guardas foco
    this.activeModal.set(event);
  }
  onCategoryCreated(newCategory: Category)
  {
    const modal = this.activeModal();
    if (!modal) return;

    this.categories.update(list => [...list, newCategory]);

    const item = this.itemsArray.at(modal.itemIndex);
    item.get('newProduct.categoryId')?.setValue(newCategory.id);

    this.activeModal.set(null);
    setTimeout(() => {
      this.focusNextElement(this.lastFocusedElement);
    });
  }
  onBrandCreated(newBrand: Brand)
  {
    const modal = this.activeModal();
    if (!modal) return;

    this.brands.update(list => [...list, newBrand]);

    const item = this.itemsArray.at(modal.itemIndex);
    item.get('newProduct.brandId')?.setValue(newBrand.id);

    this.activeModal.set(null);
    setTimeout(() => {
      this.focusNextElement(this.lastFocusedElement);
    });
  }

  handleModalKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault(); // 🔥 bloquea Shift+Tab
    }
  }
  focusNextElement(current: HTMLElement | null) {
    if (!current) return;

    const xd = Array.from(
      document.querySelectorAll<HTMLElement>(
        'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'));

    const index = xd.indexOf(current);

    if (index >= 0 && index < xd.length - 1) {
      xd[index + 1].focus();
    }
  }
}
