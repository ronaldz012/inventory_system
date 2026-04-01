import {Component, inject, input, OnInit, output, signal, DestroyRef} from '@angular/core';
import {FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {ReceptionService} from '../../../services/reception-service';
import {ItemFormGroup, NewProductFormGroup, NewReceptionForm} from './common/item-form-group';
import {VariantFormGroup} from './common/variant-form-group';
import createReceptionDto, {
  Item,
  NewProduct,
  NewVariant
} from '../../../interfaces/Dtos/Receptions/create-reception-dto';
import ReceptionItem from './reception-item/reception-item';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DecimalPipe} from '@angular/common';

@Component({
  selector: 'app-reception-form',
  imports: [
    ReactiveFormsModule,
    ReceptionItem,
    DecimalPipe,
  ],
  templateUrl: './reception-form.html',
  styles: ``,
})
export default class ReceptionForm implements OnInit {
  // ── Dependencies ──────────────────────────────────────────────────────────
  private fb = inject(FormBuilder);
  private receptionService = inject(ReceptionService);
  private destroyRef = inject(DestroyRef);

  // ── Inputs ────────────────────────────────────────────────────────────────
  branchId = input<number>(1);

  // ── Outputs ───────────────────────────────────────────────────────────────
  saved = output<void>();
  cancelled = output<void>();

  // ── Estado ────────────────────────────────────────────────────────────────
  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  totalCost = signal<number>(0);

  // ── Form ──────────────────────────────────────────────────────────────────
  form: NewReceptionForm = this.fb.group<NewReceptionForm['controls']>({
    notes: this.fb.control('', { nonNullable: true }),
    items: this.fb.array<ItemFormGroup>([]),
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.itemsArray.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculateTotalCost());
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
    this.itemsArray.push(this.buildItemGroup());
  }

  removeItem(i: number): void {
    if (this.itemsArray.length === 1) return;
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
        basePrice: this.fb.control<number>(0, { nonNullable: true }),
      }),
      variants: this.fb.array<VariantFormGroup>([]),
    });
  }

  private buildVariantGroup(): VariantFormGroup {
    return this.fb.group({
      productVariantId: this.fb.control<number | null>(null),
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
}
