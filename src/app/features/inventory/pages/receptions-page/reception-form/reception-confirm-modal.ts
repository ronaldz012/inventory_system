import { Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

/**
 * Confirmación previa al guardado de una recepción. Remarca la sucursal
 * destino (donde caerá el stock) para evitar cargas en sucursal equivocada.
 *
 * Uso:
 *   @if (showConfirm()) {
 *     <app-reception-confirm-modal
 *       [branchName]="..."
 *       [providerName]="..."
 *       [productCount]="..."
 *       [totalUnits]="..."
 *       [totalCost]="..."
 *       [submitting]="isSubmitting()"
 *       (confirm)="executeCreate()"
 *       (close)="showConfirm.set(false)"
 *     />
 *   }
 */
@Component({
  selector: 'app-reception-confirm-modal',
  imports: [CurrencyPipe],
  template: `
    <div
      class="fixed inset-0 bg-overlay z-40 flex items-end sm:items-center justify-center backdrop-blur-[2px]"
      (click)="close.emit()"
    >
      <div
        class="modal-enter w-full sm:w-[440px] bg-bg-surface
               rounded-t-2xl sm:rounded-2xl shadow-lg z-50
               px-5 pt-5 pb-7 sm:pb-5"
        (click)="$event.stopPropagation()"
      >
        <div class="sm:hidden w-10 h-1 rounded-full bg-bg-muted mx-auto mb-5"></div>

        <div class="flex items-center justify-between mb-4">
          <p class="text-sm font-semibold text-text-main">Confirmar recepción</p>
          <button
            type="button"
            (click)="close.emit()"
            [disabled]="submitting()"
            class="btn-icon hover:bg-bg-muted disabled:opacity-40"
            aria-label="Cerrar"
          >
            <span class="material-icons text-base">close</span>
          </button>
        </div>

        <!-- Sucursal destino -->
        <div class="rounded-xl border border-accent-ui/40 bg-accent-ui/10 px-4 py-3 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Esta mercadería ingresará a</p>
          <p class="text-lg font-black text-accent-ui truncate">{{ branchName() }}</p>
        </div>

        <!-- Resumen -->
        <dl class="flex flex-col gap-2 text-sm mb-5">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-soft">Proveedor</dt>
            <dd class="font-semibold text-text-main truncate">{{ providerName() }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-soft">Productos</dt>
            <dd class="font-mono font-bold text-text-main">{{ productCount() }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-soft">Unidades</dt>
            <dd class="font-mono font-bold text-text-main">{{ totalUnits() }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-soft">Costo total</dt>
            <dd class="font-mono font-extrabold text-text-main">{{ totalCost() | currency: 'BOB' : 'symbol' : '1.2-2' }}</dd>
          </div>
        </dl>

        <div class="flex flex-col sm:flex-row gap-3">
          <button (click)="close.emit()" class="btn-secondary flex-1 py-2.5 rounded-xl">
            Volver
          </button>
          <button
            (click)="confirm.emit()"
            [disabled]="submitting()"
            class="btn-primary flex-1 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            @if (submitting()) {
              <span class="opacity-70">Guardando...</span>
            } @else {
              Sí, cargar en {{ branchName() }}
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
export class ReceptionConfirmModal {
  branchName = input.required<string>();
  providerName = input.required<string>();
  productCount = input.required<number>();
  totalUnits = input.required<number>();
  totalCost = input.required<number>();
  submitting = input<boolean>(false);

  confirm = output<void>();
  close = output<void>();
}
