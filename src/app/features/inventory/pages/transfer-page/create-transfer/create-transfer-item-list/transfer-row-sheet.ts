import { Component, input, output } from '@angular/core';
import { TransferItem } from '../../../../interfaces/transfer-item';

/**
 * Bottom-sheet para una fila de la transferencia: ajustar cantidad
 * (stepper acotado al stock) o eliminar la fila. El tap en la fila lo abre;
 * así no hay borrados accidentales ni falta edición de cantidad.
 */
@Component({
  selector: 'app-transfer-row-sheet',
  standalone: true,
  imports: [],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      (click)="close.emit()"
    >
      <div class="absolute inset-0 bg-overlay backdrop-blur-[1px]"></div>
      <div
        class="modal-enter relative w-full sm:w-[420px] bg-bg-surface rounded-t-2xl sm:rounded-2xl shadow-lg px-5 pt-5 pb-7 sm:pb-5"
        (click)="$event.stopPropagation()"
      >
        <div class="sm:hidden w-10 h-1 rounded-full bg-bg-muted mx-auto mb-4"></div>

        <div class="flex items-center gap-2">
          <p class="flex-1 min-w-0 text-sm font-bold text-text-main truncate">
            @if (item().brandName) {
              <span>{{ item().brandName }} · </span>
            }{{ item().productName }}
          </p>
          <button
            type="button"
            (click)="close.emit()"
            class="btn-icon hover:bg-bg-muted shrink-0"
            aria-label="Cerrar"
          >
            <span class="material-icons text-base">close</span>
          </button>
        </div>
        <div class="flex items-center gap-1.5 mt-2 flex-wrap">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-md bg-accent-ui/10 border border-accent-ui/20 text-[11px] font-bold text-accent-ui"
            >{{ item().colorName }}</span
          >
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-md bg-bg-muted border border-border text-[11px] font-bold text-text-main"
            >#{{ item().size }}</span
          >
          <span class="font-mono text-[11px] text-text-soft truncate">{{ item().sku }}</span>
        </div>

        <div class="flex items-center justify-between gap-3 mt-5">
          <span class="field-label">Cantidad (máx. {{ item().maxQuantity }})</span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="step(-1)"
              [disabled]="item().quantity <= 1"
              aria-label="Quitar uno"
              class="w-9 h-9 rounded-lg border border-border bg-bg-muted text-text-main flex items-center justify-center text-lg font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-elevated active:scale-95 transition-all"
            >
              −
            </button>
            <span class="w-10 text-center text-base font-mono font-bold tabular-nums text-text-main">
              {{ item().quantity }}
            </span>
            <button
              type="button"
              (click)="step(1)"
              [disabled]="item().quantity >= item().maxQuantity"
              aria-label="Agregar uno"
              class="w-9 h-9 rounded-lg border border-border bg-bg-muted text-text-main flex items-center justify-center text-lg font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-elevated active:scale-95 transition-all"
            >
              +
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2 mt-6">
          <button
            type="button"
            (click)="remove.emit()"
            class="btn-danger py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            <span class="material-icons text-base leading-none">delete</span>
            Eliminar de la transferencia
          </button>
          <button type="button" (click)="close.emit()" class="btn-secondary py-2.5 rounded-xl">
            Cancelar
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
export class TransferRowSheet {
  item = input.required<TransferItem>();

  /** Nueva cantidad (en vivo por cada tap del stepper). */
  save = output<number>();
  remove = output<void>();
  close = output<void>();

  step(delta: 1 | -1): void {
    const next = this.item().quantity + delta;
    if (next < 1 || next > this.item().maxQuantity) return;
    this.save.emit(next);
  }
}
