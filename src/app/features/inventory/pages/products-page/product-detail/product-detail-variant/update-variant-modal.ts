import { Component, input, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {ProductVariantDto} from '../../../../dtos/products/product-detail-dto';
import {UpdateProductVariantDto} from '../../../../dtos/products/update-product-variant-dto';



/**
 * Modal for updating a product variant's fields.
 *
 * Usage:
 *   @if (editVariant()) {
 *     <app-update-variant-modal
 *       [variant]="editVariant()!"
 *       [submitting]="submitting()"
 *       (save)="onUpdateVariant($event)"
 *       (close)="editVariant.set(null)"
 *     />
 *   }
 */
@Component({
  selector: 'app-update-variant-modal',
  imports: [FormsModule],
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

        <p class="text-sm font-semibold text-text-main mb-0.5">Editar talla/color</p>
        <p class="font-mono text-[11px] text-text-soft mb-5">{{ variant().sku }}</p>

        <div class="flex flex-col gap-4">

          <!-- Precio -->
          <div>
            <label class="field-label block">Precio</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-soft">Bs</span>
              <input
                type="number"
                [(ngModel)]="form.price"
                min="0.01"
                step="0.01"
                class="w-full pl-10 pr-3 py-2 text-sm text-text-main bg-bg-surface border border-border rounded-lg
                       focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring-focus-ring"
                placeholder="0.00"
              />
            </div>
          </div>

          <!-- Descripción -->
          <div>
            <label class="field-label block">
              Descripción <span class="text-text-soft/50">(opcional)</span>
            </label>
            <textarea
              [(ngModel)]="form.description"
              rows="2"
              class="w-full px-3 py-2 text-sm text-text-main bg-bg-surface border border-border rounded-lg resize-none
                     focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring-focus-ring"
              placeholder="Detalles adicionales de la talla/color..."
            ></textarea>
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
              Guardar cambios
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    @keyframes modal-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .modal-enter {
      animation: modal-in 180ms ease both;
    }
  `,
})
export class UpdateVariantModal implements OnInit {
  variant    = input.required<ProductVariantDto>();
  submitting = input<boolean>(false);

  save  = output<UpdateProductVariantDto>();
  close = output<void>();

  form: UpdateProductVariantDto = {
    description: '',
    price:       undefined,
  };

  ngOnInit(): void {
    const v = this.variant();
    this.form.price       = v.price;
    this.form.description = v.description ?? '';
  }

  onSave(): void {
    const dto: UpdateProductVariantDto = {};

    if (this.form.price != null)       dto.price       = this.form.price;
    if (this.form.description?.trim()) dto.description = this.form.description.trim();

    this.save.emit(dto);
  }
}
