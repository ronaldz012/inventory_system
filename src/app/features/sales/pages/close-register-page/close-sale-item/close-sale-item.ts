import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ClosureSaleItemDto } from '@features/sales/dtos/closure-detail-dto';
import {
  SaleReturnStatus,
  isCashPayment,
  isReturnType,
  returnStatusValue,
} from '@features/sales/dtos/sale-detail-dto';
import { PermissionService } from '@features/auth/services/permmision-service';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';

/**
 * Fila de una venta del turno dentro del cierre de caja, orientada al arqueo.
 *
 * Resumen (#, hora, monto, tipo, pago, art.) + ítems vendidos siempre visibles,
 * en mobile y desktop. Todo el resumen (mobile) y el "Ver más" (desktop) llevan
 * al detalle de venta si el rol tiene `sales read`.
 */
@Component({
  selector: 'li[app-close-sale-item]',
  imports: [RouterLink, MoneyPipe, SmartDatePipe],
  host: { class: 'bg-bg-surface block' },
  template: `
    <!-- ── Móvil: card plana con ítems visibles ── -->
    <div class="lg:hidden px-4 py-3 flex flex-col gap-2">
      @if (canOpenDetail()) {
        <a
          [routerLink]="['/sales/sale', sale().id]"
          class="flex items-center gap-2 min-w-0 -mx-1 px-1 py-0.5 rounded-lg hover:bg-bg-muted/60 transition-colors"
        >
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
          <span class="material-icons text-xl text-accent-ui shrink-0">chevron_right</span>
        </a>
      } @else {
        <div class="flex items-center gap-2 min-w-0">
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
        </div>
      }
      <div class="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
        <span [class]="isReturn() ? 'text-feedback-warning-text' : 'text-accent-ui'">
          {{ isReturn() ? 'Devolución' : 'Venta' }}
        </span>
        @if (originalSaleNumber(); as original) {
          <span class="text-text-soft">de #{{ original }}</span>
        }
        @if (returnBadge(); as badge) {
          <span class="text-feedback-warning-text">· {{ badge }}</span>
        }
        <span class="text-text-soft">·</span>
        <span class="text-text-muted">{{ isCash() ? 'Efectivo' : 'QR' }}</span>
        <span class="text-text-soft">·</span>
        <span class="text-text-muted">{{ articles() }} art.</span>
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
      class="hidden lg:grid lg:grid-cols-[12rem_8rem_6rem_7rem_5rem_8rem] items-center px-6 py-3 hover:bg-bg-muted/30 transition-colors"
    >
      <span class="flex flex-col leading-tight min-w-0">
        <span class="text-[13px] text-text-main font-mono truncate">
          <span class="font-bold">#{{ sale().number }}</span>
          <span class="text-text-soft"> · {{ sale().createdAt | smartDate }}</span>
        </span>
        @if (originalSaleNumber(); as original) {
          <span class="text-[10px] font-mono text-feedback-warning-text">de #{{ original }}</span>
        }
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
        @if (returnBadge(); as badge) {
          <span class="block text-[10px] font-semibold text-feedback-warning-text mt-0.5">{{
            badge
          }}</span>
        }
      </span>
      <span class="text-center">
        <span [class]="isCash() ? 'chip-neutral' : 'chip-info'">
          {{ isCash() ? 'Efectivo' : 'QR' }}
        </span>
      </span>
      <span class="chip-accent font-mono w-fit ml-auto">
        {{ articles() }}
      </span>
      @if (canOpenDetail()) {
        <div class="flex justify-end">
          <a [routerLink]="['/sales', 'sale', sale().id]" class="btn-link">
            <span class="btn-link-text">Ver más</span>
            <span class="material-icons text-base">chevron_right</span>
          </a>
        </div>
      } @else {
        <span></span>
      }
    </div>
    @if (sale().items.length > 0) {
      <div class="hidden lg:flex lg:flex-col gap-1 pl-[13.5rem] pr-6 pb-3 -mt-1.5">
        @for (item of sale().items; track $index) {
          <div class="flex items-baseline gap-2 text-xs">
            <span
              class="shrink-0 w-20 truncate font-mono font-bold"
              [class.text-accent-ui]="item.productVariantId != null"
              [class.text-feedback-warning-text]="item.productVariantId == null"
              [title]="item.productVariantId != null ? item.productSku : 'Venta libre'"
            >
              {{ item.productVariantId != null ? item.productSku : 'Libre' }}
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

  readonly perm = inject(PermissionService);
  /** "Ver más"/detalle solo si el rol puede leer la feature de ventas. */
  canOpenDetail = computed(() => this.perm.canRead('sales', 'sales'));

  isReturn = computed(() => isReturnType(this.sale().type));
  isCash = computed(() => isCashPayment(this.sale().paymentMethod));

  /** Artículos para mostrar: en devoluciones el backend guarda la cantidad negativa. */
  articles = computed(() => Math.abs(this.sale().itemsCount));

  /** "Parcial"/"Devuelta" en ventas con devolución; null si no aplica. */
  returnBadge = computed(() => {
    if (this.isReturn()) return null;
    const status = returnStatusValue(this.sale().returnStatus);
    if (status === SaleReturnStatus.Partial) return 'Parcial';
    if (status === SaleReturnStatus.Full) return 'Devuelta';
    return null;
  });

  /** Nº de la venta original cuando esta fila es una devolución. */
  originalSaleNumber = computed(() => (this.isReturn() ? this.sale().originalSaleNumber : null));
}
