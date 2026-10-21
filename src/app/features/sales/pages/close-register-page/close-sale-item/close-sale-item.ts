import { Component, computed, input } from '@angular/core';
import { ClosureSaleItemDto } from '@features/sales/dtos/closure-detail-dto';
import { isCashPayment, isReturnType } from '@features/sales/dtos/sale-detail-dto';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';

/**
 * Fila de una venta del turno dentro del cierre de caja, orientada al arqueo.
 *
 * Resumen (#, hora, monto, tipo, pago, art.) + ítems vendidos siempre visibles,
 * en mobile y desktop. El ">" es la puerta a "ver detalle" (fase 2); hoy no
 * navega ni reembolsa: eso vive en la feature de ventas.
 */
@Component({
  selector: 'li[app-close-sale-item]',
  imports: [MoneyPipe, SmartDatePipe],
  host: { class: 'bg-bg-surface block' },
  template: `
    <!-- ── Móvil: card plana con ítems visibles ── -->
    <div class="lg:hidden px-4 py-3 flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <span class="text-xs font-mono font-bold text-text-main shrink-0"
          >#{{ sale().number }}</span
        >
        <span class="text-[11px] text-text-soft truncate min-w-0">{{
          sale().createdAt | smartDate
        }}</span>
        <span
          class="ml-auto shrink-0 text-sm font-mono font-black text-text-main"
          [class.text-feedback-warning-text]="isReturn()"
        >
          {{ sale().totalAmount | money }}
        </span>
        <span class="material-icons !text-[16px] text-text-soft shrink-0">chevron_right</span>
      </div>
      <div class="flex items-center gap-1.5 text-[10px] font-semibold">
        <span [class]="isReturn() ? 'text-feedback-warning-text' : 'text-accent-ui'">
          {{ isReturn() ? 'Devolución' : 'Venta' }}
        </span>
        <span class="text-text-soft">·</span>
        <span class="text-text-muted">{{ isCash() ? 'Efectivo' : 'QR' }}</span>
        <span class="text-text-soft">·</span>
        <span class="text-text-muted">{{ sale().itemsCount }} art.</span>
        @if (sale().hasReturn) {
          <span class="text-text-soft">· Reembolsada</span>
        }
      </div>

      @if (sale().items.length > 0) {
        <div class="flex flex-col gap-1.5 pt-1.5 border-t border-border/40">
          @for (item of sale().items; track $index) {
            <div class="flex items-start gap-2 text-[12px] leading-snug">
              <span class="shrink-0 w-7 text-right font-mono font-bold text-text-muted">
                ×{{ item.quantity }}
              </span>
              <span
                class="flex-1 min-w-0 line-clamp-2 text-text-main"
                [title]="item.productDisplayName"
              >
                {{ item.productDisplayName }}
              </span>
              <span class="shrink-0 font-mono font-semibold text-text-main">
                {{ item.finalPrice | money }}
              </span>
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Desktop: fila de tabla + ítems siempre listados ── -->
    <div
      class="hidden lg:grid lg:grid-cols-[12rem_8rem_6rem_7rem_5rem] items-center px-6 py-3 hover:bg-bg-muted/30 transition-colors"
    >
      <span class="text-[13px] text-text-main font-mono truncate">
        <span class="font-bold">#{{ sale().number }}</span>
        <span class="text-text-soft"> · {{ sale().createdAt | smartDate }}</span>
      </span>
      <span
        class="text-right text-[13px] font-mono font-bold text-text-main"
        [class.text-feedback-warning-text]="isReturn()"
      >
        {{ sale().totalAmount | money }}
      </span>
      <span class="text-center">
        <span [class]="isReturn() ? 'chip-warning' : 'chip-accent'">
          {{ isReturn() ? 'Devolución' : 'Venta' }}
        </span>
      </span>
      <span class="text-center">
        <span [class]="isCash() ? 'chip-neutral' : 'chip-info'">
          {{ isCash() ? 'Efectivo' : 'QR' }}
        </span>
        @if (sale().hasReturn) {
          <span class="block text-[10px] text-text-soft mt-0.5">Reembolsada</span>
        }
      </span>
      <span class="chip-accent font-mono w-fit ml-auto">
        {{ sale().itemsCount }}
      </span>
    </div>
    @if (sale().items.length > 0) {
      <div class="hidden lg:flex lg:flex-col gap-1 pl-[13.5rem] pr-6 pb-3 -mt-1.5">
        @for (item of sale().items; track $index) {
          <div class="flex items-baseline gap-2 text-xs">
            <span
              class="shrink-0 w-20 truncate font-mono text-accent-ui font-bold"
              [title]="item.productSku"
            >
              {{ item.productSku }}
            </span>
            <span class="shrink-0 w-7 text-right font-mono font-bold text-text-muted">
              ×{{ item.quantity }}
            </span>
            <span class="flex-1 min-w-0 truncate" [title]="item.productDisplayName">
              {{ item.productDisplayName }}
            </span>
            <span class="shrink-0 font-mono font-semibold text-text-main">
              {{ item.finalPrice | money }}
            </span>
          </div>
        }
      </div>
    }
  `,
})
export class CloseSaleItem {
  sale = input.required<ClosureSaleItemDto>();

  isReturn = computed(() => isReturnType(this.sale().type));
  isCash = computed(() => isCashPayment(this.sale().paymentMethod));
}
