import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductVariantDto } from '../../../../dtos/products/product-detail-dto';
import { UpdateProductVariantStockDto } from '../../../../dtos/products/update-product-variant-stock-dto';

/**
 * Modal for adjusting the stock of a variant in the current branch.
 * The displayed stock is the current value; +/- buttons adjust it.
 * The backend receives the final absolute value.
 *
 * Usage:
 *   @if (adjustStockVariant()) {
 *     <app-adjust-stock-modal
 *       [variant]="adjustStockVariant()!"
 *       [submitting]="submitting()"
 *       (save)="onAdjustStock($event)"import { ProductVariantDto } from '../../../dtos/products/product-detail-dto';
import { UpdateProductVariantStockDto } from '../../../dtos/producclass UpdateProductVariantStockDto {
 class UpdateProductVariantStockDto {
 stock:number;
 str
 }ts/update-product-variant-stock-dto';
 *       (close)="adjustStockVariant.set(null)"
 *     />
 *   }
 */
@Component({
  selector: 'app-adjust-stock-modal',
  imports: [FormsModule],
  template: `
    <!-- Overlay -->
    <div
      class="fixed inset-0 bg-black/30 z-40 flex items-end sm:items-center justify-center backdrop-blur-[2px]"
      (click)="close.emit()"
    >
      <!-- Sheet / Dialog -->
      <div
        class="modal-enter w-full sm:w-[380px] bg-bg-surface
               rounded-t-2xl sm:rounded-2xl shadow-lg z-50
               px-5 pt-5 pb-7 sm:pb-5"
        (click)="$event.stopPropagation()"
      >
        <!-- Handle (mobile) -->
        <div class="sm:hidden w-10 h-1 rounded-full bg-bg-muted mx-auto mb-5"></div>

        <p class="text-sm font-semibold text-text-main mb-0.5">Ajustar stock</p>
        <p class="font-mono text-[11px] text-text-soft mb-5">{{ variant().sku }}</p>

        <!-- Stock adjuster -->
        <div class="flex items-center justify-center gap-4 py-4 mb-2">
          <button
            type="button"
            (click)="decrement()"
            [disabled]="newStock() <= 0"
            class="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center
                   text-text-muted hover:border-border-strong hover:bg-bg-muted transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed text-lg font-light"
          >
            −
          </button>

          <div class="text-center min-w-[80px]">
            <p class="text-4xl font-bold tabular-nums" [class]="deltaClass()">{{ newStock() }}</p>
            <p class="text-xs text-text-soft mt-1">
              @if (delta() === 0) {
                Sin cambios
              } @else if (delta() > 0) {
                <span class="text-feedback-success-text">+{{ delta() }} unidades</span>
              } @else {
                <span class="text-feedback-error-text">{{ delta() }} unidades</span>
              }
            </p>
          </div>

          <button
            type="button"
            (click)="increment()"
            class="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center
                   text-text-muted hover:border-border-strong hover:bg-bg-muted transition-colors
                   text-lg font-light"
            aria-label="Sumar una unidad"
          >
            +
          </button>
        </div>

        <!-- Current stock reference -->
        <p class="text-center text-xs text-text-soft mb-1">
          Stock actual
          @if (currentBranchName()) {
            en {{ currentBranchName() }}
          }
          :
          <span class="font-medium text-text-muted">{{ currentStock() }} u</span>
        </p>
        <p class="text-center text-xs text-text-soft/70 mb-5">
          Los ajustes (altas y bajas) requieren motivo
        </p>

        <!-- Notes -->
        <div>
          <label class="block text-xs text-text-soft mb-1">
            Motivo del ajuste <span class="text-text-soft/60">(mínimo 3 caracteres)</span>
          </label>
          <textarea
            [value]="notes()"
            (input)="notes.set($any($event.target).value)"
            rows="2"
            class="w-full px-3 py-2 text-sm border rounded-lg resize-none transition-colors
                   focus:outline-none focus:ring-2"
            [class]="
              notesInvalid()
                ? 'border-feedback-error-text focus:ring-feedback-error'
                : 'border-border focus:border-border-strong focus:ring-ring-focus-ring'
            "
            placeholder="Ej: Conteo físico, sobrante, corrección de error, devolución..."
          ></textarea>
          @if (notesInvalid()) {
            <p class="text-xs text-feedback-error-text mt-1">
              El motivo es obligatorio (mínimo 3 caracteres).
            </p>
          }
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3 mt-5">
          <button (click)="close.emit()" class="btn-secondary flex-1 py-2.5 rounded-xl">
            Cancelar
          </button>
          <button
            (click)="onSave()"
            [disabled]="submitting() || !canSave()"
            class="btn-primary flex-1 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            @if (submitting()) {
              <span class="opacity-70">Guardando...</span>
            } @else {
              Confirmar ajuste
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
export class AdjustStockModal implements OnInit {
  variant = input.required<ProductVariantDto>();
  currentStock = input(0);
  currentBranchName = input<string | null>(null);
  submitting = input<boolean>(false);

  save = output<UpdateProductVariantStockDto>();
  close = output<void>();

  newStock = signal(0);
  notes = signal('');
  touched = signal(false);

  delta = computed(() => this.newStock() - this.currentStock());

  deltaClass = computed(() => {
    const d = this.delta();
    if (d < 0) return 'text-feedback-error-text';
    if (d > 0) return 'text-feedback-success-text';
    return 'text-text-main';
  });

  notesInvalid = computed(() => this.touched() && this.notes().trim().length < 3);
  canSave = computed(() => this.delta() !== 0 && this.notes().trim().length >= 3);

  ngOnInit(): void {
    this.newStock.set(this.currentStock());
  }

  increment(): void {
    this.newStock.update((v) => v + 1);
  }

  decrement(): void {
    if (this.newStock() > 0) this.newStock.update((v) => v - 1);
  }

  onSave(): void {
    this.touched.set(true);
    if (!this.canSave()) return;

    this.save.emit({
      stock: this.newStock(),
      notes: this.notes().trim(),
    });
  }
}
