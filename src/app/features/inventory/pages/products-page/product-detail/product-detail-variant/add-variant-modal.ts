import { Component, inject, input, output, signal } from '@angular/core';
import { form, FormField, min, required, validate } from '@angular/forms/signals';
import { ColorSelectCtrl } from '@features/inventory/components/color-select-ctrl/color-select-ctrl.component';
import { SizeSelectCtrl } from '@features/inventory/components/size-select-ctrl/size-select-ctrl.component';
import { ColorService } from '@features/inventory/services/color-service';
import { ProductVariantDto } from '../../../../dtos/products/product-detail-dto';
import { CreateProductVariantDto } from '../../../../dtos/products/create-product-variant-dto';

interface AddVariantModel {
  sizeId: GUID;
  sizeName: string;
  colorId: GUID;
  colorName: string;
  price: number | null;
}

/**
 * Modal for adding a new talla/color to an existing product.
 *
 * Usage:
 *   @if (showAddVariant()) {
 *     <app-add-variant-modal
 *       [existingVariants]="product()!.variants"
 *       [submitting]="submitting()"
 *       (save)="onAddVariants($event)"
 *       (close)="showAddVariant.set(false)"
 *     />
 *   }
 */
@Component({
  selector: 'app-add-variant-modal',
  imports: [FormField, ColorSelectCtrl, SizeSelectCtrl],
  template: `
    <!-- Overlay -->
    <div
      class="fixed inset-0 bg-overlay z-40 flex items-end sm:items-center justify-center backdrop-blur-[2px]"
      (click)="close.emit()"
    >
      <!-- Sheet / Dialog -->
      <div
        class="modal-enter w-full sm:w-[420px] bg-bg-surface
               rounded-t-2xl sm:rounded-2xl shadow-lg z-50
               px-5 pt-5 pb-7 sm:pb-5"
        (click)="$event.stopPropagation()"
      >
        <!-- Handle (mobile) -->
        <div class="sm:hidden w-10 h-1 rounded-full bg-bg-muted mx-auto mb-5"></div>

        <p class="text-sm font-semibold text-text-main mb-5">Nueva talla/color</p>

        <div class="flex flex-col gap-4">
          <!-- Color -->
          <div>
            <label class="field-label block">Color</label>
            <app-color-select-ctrl
              [fieldState]="addVariantForm.colorId()"
              [colorNameState]="addVariantForm.colorName()"
            />
            @if (addVariantForm.colorId().touched() && addVariantForm.colorId().invalid()) {
              @for (error of addVariantForm.colorId().errors(); track error.kind) {
                <span class="text-xs text-feedback-error-text font-medium leading-none mt-1 block">
                  {{ error.message }}
                </span>
              }
            }
          </div>

          <!-- Talla -->
          <div>
            <label class="field-label block">Talla</label>
            <app-size-select-ctrl
              [fieldState]="addVariantForm.sizeId()"
              [sizeNameState]="addVariantForm.sizeName()"
            />
            @if (addVariantForm.sizeId().touched() && addVariantForm.sizeId().invalid()) {
              @for (error of addVariantForm.sizeId().errors(); track error.kind) {
                <span class="text-xs text-feedback-error-text font-medium leading-none mt-1 block">
                  {{ error.message }}
                </span>
              }
            }
          </div>

          <!-- Precio -->
          <div>
            <label class="field-label block">Precio</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-soft"
                >Bs</span
              >
              <input
                type="number"
                [formField]="addVariantForm.price"
                step="0.01"
                class="w-full pl-9 pr-3 py-2 text-sm text-text-main bg-bg-surface border border-border rounded-lg
                       focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring-focus-ring"
                placeholder="0.00"
              />
            </div>
            @if (addVariantForm.price().touched() && addVariantForm.price().invalid()) {
              @for (error of addVariantForm.price().errors(); track error.kind) {
                <span class="text-xs text-feedback-error-text font-medium leading-none mt-1 block">
                  {{ error.message }}
                </span>
              }
            }
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3 mt-6">
          <button (click)="close.emit()" class="btn-secondary flex-1 py-2.5 rounded-xl">
            Cancelar
          </button>
          <button
            (click)="onSave()"
            [disabled]="submitting()"
            class="btn-primary flex-1 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            @if (submitting()) {
              <span class="opacity-70">Guardando...</span>
            } @else {
              Agregar variante
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    @keyframes modal-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .modal-enter {
      animation: modal-in 180ms ease both;
    }
  `,
})
export default class AddVariantModal {
  existingVariants = input.required<Pick<ProductVariantDto, 'colorId' | 'sizeId'>[]>();
  submitting = input<boolean>(false);

  save = output<CreateProductVariantDto>();
  close = output<void>();

  private colorService = inject(ColorService);

  constructor() {
    this.colorService.load();
  }

  model = signal<AddVariantModel>({
    sizeId: '' as GUID,
    sizeName: '',
    colorId: '' as GUID,
    colorName: '',
    price: null,
  });

  addVariantForm = form(this.model, (s) => {
    required(s.sizeId, { message: 'Requerido' });
    required(s.colorId, { message: 'Requerido' });
    required(s.price, { message: 'Requerido' });
    min(s.price, 0.5, { message: 'Mín Bs 0.50' });

    validate(s.colorId, ({ valueOf }) => {
      const sizeId = valueOf(s.sizeId);
      const colorId = valueOf(s.colorId);
      if (!sizeId || !colorId) return null;

      const exists = this.existingVariants().some(
        (v) => v.colorId === colorId && v.sizeId === sizeId,
      );
      return exists
        ? { kind: 'duplicateVariant', message: 'La combinación de color y talla ya existe' }
        : null;
    });
  });

  onSave(): void {
    this.addVariantForm().markAsTouched();
    this.addVariantForm().markAsDirty();
    if (this.addVariantForm().invalid()) return;

    const m = this.model();
    this.save.emit({
      sizeId: m.sizeId,
      colorId: m.colorId,
      price: m.price ?? 0,
    });
  }
}
