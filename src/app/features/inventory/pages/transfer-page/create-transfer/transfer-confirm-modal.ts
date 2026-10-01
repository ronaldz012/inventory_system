import { Component, input, output } from '@angular/core';

/**
 * Confirmación previa a crear una transferencia. Remarca origen → destino
 * para evitar envíos a sucursal equivocada.
 *
 * Uso:
 *   @if (showConfirm()) {
 *     <app-transfer-confirm-modal
 *       [originName]="..."
 *       [destName]="..."
 *       [productCount]="..."
 *       [totalUnits]="..."
 *       [notes]="..."
 *       [submitting]="isSubmitting()"
 *       (confirm)="executeCreate()"
 *       (close)="closeConfirm()"
 *     />
 *   }
 */
@Component({
  selector: 'app-transfer-confirm-modal',
  imports: [],
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
          <p class="text-sm font-semibold text-text-main">Confirmar transferencia</p>
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

        <!-- Origen → Destino -->
        <div class="rounded-xl border border-accent-ui/40 bg-accent-ui/10 px-4 py-3 mb-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Vas a transferir de</p>
          <p class="text-base font-black text-text-main truncate">
            {{ originName() }}
            <span class="material-icons text-base text-accent-ui align-middle mx-1">arrow_forward</span>
            <span class="text-accent-ui">{{ destName() }}</span>
          </p>
        </div>

        <!-- Resumen -->
        <dl class="flex flex-col gap-2 text-sm mb-5">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-soft">Productos</dt>
            <dd class="font-mono font-bold text-text-main">{{ productCount() }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-soft">Unidades</dt>
            <dd class="font-mono font-bold text-text-main">{{ totalUnits() }}</dd>
          </div>
          @if (notes()) {
            <div class="flex items-start justify-between gap-3">
              <dt class="text-text-soft shrink-0">Notas</dt>
              <dd class="font-medium text-text-main text-right break-words">{{ notes() }}</dd>
            </div>
          }
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
              <span class="opacity-70">Creando...</span>
            } @else {
              Sí, transferir
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
export class TransferConfirmModal {
  originName = input.required<string>();
  destName = input.required<string>();
  productCount = input.required<number>();
  totalUnits = input.required<number>();
  notes = input<string>('');
  submitting = input<boolean>(false);

  confirm = output<void>();
  close = output<void>();
}
