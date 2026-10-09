import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ClosureDetailDto } from '@features/sales/dtos/closure-detail-dto';
import { isReturnType, isCashPayment } from '@features/sales/dtos/sale-detail-dto';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import ReturnRefund from '@features/sales/pages/returns-page/return-refund';
import { blockNonNumericKeys } from '@shared/utils/list-query';
import { closeModal, getModalId, openModal } from '@shared/utils/modal-query';

@Component({
  selector: 'app-close-register-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink, SkeletonList, SmartDatePipe, ReturnRefund],
  styles: `
    @keyframes fade-up {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .fade-up {
      animation: fade-up 240ms ease both;
    }
  `,
  template: `
    <div class="max-w-6xl mx-auto fade-up">
      @if (state() === 'init') {
        <app-skeleton-list [rows]="3" [columns]="2" />
      } @else if (state() === 'already-closed') {
        <div
          class="flex flex-col items-center gap-3 p-12 rounded-xl border border-border bg-bg-surface shadow-xs"
        >
          <span class="material-icons text-4xl text-text-soft opacity-60">lock</span>
          <p class="text-sm font-medium text-text-muted">Esta caja ya está cerrada.</p>
          <a routerLink="/sales/pos" class="text-xs font-medium text-accent-ui hover:underline"
            >Volver al POS</a
          >
        </div>
      } @else if (state() === 'error') {
        <div
          class="flex flex-col items-center gap-3 p-12 rounded-xl border border-border bg-bg-surface shadow-xs"
        >
          <span class="material-icons text-4xl text-feedback-error-text">error_outline</span>
          <p class="text-sm font-medium text-text-muted">{{ errorMessage() }}</p>
          <a routerLink="/sales/pos" class="text-xs font-medium text-accent-ui hover:underline"
            >Volver al POS</a
          >
        </div>
      } @else {
        @let c = closure()!;
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <a routerLink="/sales/pos" class="btn-icon">
              <span class="material-icons text-base">arrow_back</span>
            </a>
            <h1 class="text-lg font-black text-text-main">Cierre de Caja</h1>
          </div>

          <div class="bg-bg-surface rounded-xl border border-border-strong px-4 py-3">
            <p class="text-sm font-semibold text-text-main">Turno #{{ c.number }}</p>
            <p class="text-xs text-text-muted mt-0.5 truncate">
              {{ c.openedAt | smartDate }} · {{ c.openedByName }} · Apertura
              {{ c.openingBalance | number: '1.2-2' }}
            </p>

            <div class="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-2 mt-2 pt-2 border-t border-border">
              <div>
                <p class="table-header">Ventas</p>
                <p class="text-base font-black text-text-main font-mono">
                  {{ c.totalSales | number: '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Efectivo</p>
                <p class="text-base font-black text-text-main font-mono">
                  {{ c.cashSales | number: '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">QR</p>
                <p class="text-base font-black text-text-main font-mono">
                  {{ c.qrSales | number: '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Gastos</p>
                <p class="text-base font-black text-feedback-error-text font-mono">
                  {{ c.totalExpenses | number: '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Esperado</p>
                <p class="text-base font-black text-accent-ui font-mono">
                  {{ expectedAmount() | number: '1.2-2' }}
                </p>
              </div>
            </div>
          </div>

          @if (c.sales.length > 0) {
            <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
              <div class="px-6 pt-5 pb-3 flex items-center justify-between">
                <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Ventas del turno ({{ c.sales.length }})</p>
                <span class="text-xs font-bold text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md">{{ c.sales.length }} venta(s)</span>
              </div>
              <div class="hidden lg:grid lg:grid-cols-[9rem_8rem_6rem_7rem_5rem_5rem] px-6 py-2 bg-bg-muted border-y border-border text-[10px] font-bold uppercase tracking-wider text-text-soft">
                <span>Hora</span>
                <span class="text-right">Monto</span>
                <span class="text-center">Tipo</span>
                <span class="text-center">Pago</span>
                <span class="text-right">Art.</span>
                <span></span>
              </div>
              <ul class="flex flex-col divide-y divide-border">
                @for (sale of c.sales; track sale.id) {
                  <li class="bg-bg-surface">
                    <!-- Mobile card -->
                    <div class="lg:hidden px-4 py-4 flex flex-col gap-3">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-bold text-text-main font-mono">{{ sale.createdAt | smartDate }}</span>
                        <span class="text-sm font-mono font-black text-text-main">{{ sale.totalAmount | number: '1.2-2' }}</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        @if (isReturnType(sale.type)) {
                          <span class="text-[11px] font-bold text-feedback-warning-text bg-feedback-warning/15 border border-feedback-warning/30 px-2 py-0.5 rounded-md">Devolución</span>
                        } @else {
                          <span class="text-[11px] font-bold text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md">Venta</span>
                        }
                        @if (isCashPayment(sale.paymentMethod)) {
                          <span class="text-[11px] font-medium text-text-muted bg-bg-muted px-2 py-0.5 rounded-md">Efectivo</span>
                        } @else {
                          <span class="text-[11px] font-medium text-feedback-info-text bg-feedback-info-bg/15 px-2 py-0.5 rounded-md">Pago Móvil</span>
                        }
                        <span class="text-xs font-bold text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md">{{ sale.itemsCount }} art.</span>
                      </div>
                      @if (sale.items.length > 0) {
                        <ul class="flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
                          @for (item of sale.items; track item.productVariantId) {
                            <li class="px-3 py-2.5 flex flex-col gap-1 bg-bg-surface">
                              <span class="font-mono text-[11px] font-bold tracking-wide text-accent-ui">{{ item.productSku }}</span>
                              <p class="text-[13px] font-semibold text-text-main break-words leading-snug">{{ item.productDisplayName }}</p>
                              <div class="flex flex-wrap items-center gap-2 text-xs">
                                <span class="px-2 py-0.5 rounded-md bg-bg-muted border border-border font-mono font-medium text-text-main">×{{ item.quantity }} · {{ item.finalPrice | number: '1.2-2' }}</span>
                                <span class="text-text-soft font-mono">{{ item.unitPrice | number: '1.2-2' }} c/u</span>
                              </div>
                            </li>
                          }
                        </ul>
                      }
                      @if (perm.can('sales', 'pos', 'create')) {
                        <div class="flex justify-end">
                          @if (sale.hasReturn) {
                            <span class="text-[11px] font-bold text-text-soft bg-bg-muted px-2 py-1 rounded-md" [title]="sale.cantReturnReason || 'Con reembolso'">Con reembolso</span>
                          } @else if (!sale.canReturn) {
                            @if (sale.cantReturnReason !== 'IS_RETURN') {
                              <span class="text-[11px] font-bold text-text-soft bg-bg-muted px-2 py-1 rounded-md" [title]="sale.cantReturnReason || ''">No disponible</span>
                            }
                          } @else {
                            <button type="button" (click)="goToRefund(sale.id)" class="action-text action-text--edit">Devolver</button>
                          }
                        </div>
                      }
                    </div>
                    <!-- Desktop row -->
                    <div class="hidden lg:block">
                      <div class="grid lg:grid-cols-[9rem_8rem_6rem_7rem_5rem_5rem] items-center px-6 py-3 hover:bg-bg-muted/30 transition-colors">
                        <span class="text-[13px] text-text-main font-mono">{{ sale.createdAt | smartDate }}</span>
                        <span class="text-right text-[13px] font-mono font-bold text-text-main" [class.text-feedback-warning-text]="isReturnType(sale.type)">{{ sale.totalAmount | number: '1.2-2' }}</span>
                        <span class="text-center">
                          @if (isReturnType(sale.type)) {
                            <span class="text-[11px] font-bold text-feedback-warning-text bg-feedback-warning/15 border border-feedback-warning/30 px-2 py-0.5 rounded-md">Devolución</span>
                          } @else {
                            <span class="text-[11px] font-bold text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md">Venta</span>
                          }
                        </span>
                        <span class="text-center">
                          @if (isCashPayment(sale.paymentMethod)) {
                            <span class="text-[11px] font-medium text-text-muted bg-bg-muted px-2 py-0.5 rounded-md">Efectivo</span>
                          } @else {
                            <span class="text-[11px] font-medium text-feedback-info-text bg-feedback-info-bg/10 px-2 py-0.5 rounded-md">Pago Móvil</span>
                          }
                        </span>
                        <span class="text-right text-xs font-bold font-mono text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md w-fit ml-auto">{{ sale.itemsCount }}</span>
                        <span class="flex justify-end">
                          @if (perm.can('sales', 'pos', 'create')) {
                            @if (sale.hasReturn) {
                              <span class="text-[11px] font-bold text-text-soft bg-bg-muted px-2 py-1 rounded-md" [title]="sale.cantReturnReason || 'Con reembolso ya realizado'">Con reembolso</span>
                            } @else if (sale.canReturn) {
                              <button type="button" (click)="goToRefund(sale.id)" class="action-btn action-btn--edit" title="Devolver">
                                <span class="material-icons text-base">assignment_return</span>
                              </button>
                            }
                          } @else {
                            <span class="text-xs text-text-soft">—</span>
                          }
                        </span>
                      </div>
                      @if (sale.items.length > 0) {
                        <div class="mx-6 mb-3 rounded-lg border border-border bg-bg-muted/30 overflow-hidden">
                          <div class="hidden lg:grid lg:grid-cols-[8rem_1fr_6.5rem_5rem_7rem] px-3 py-1.5 bg-bg-muted border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-soft">
                            <span>SKU</span><span>Producto</span><span class="text-right">Precio</span><span class="text-right">Cant.</span><span class="text-right">Subtotal</span>
                          </div>
                          @for (item of sale.items; track item.productVariantId) {
                            <div class="grid lg:grid-cols-[8rem_1fr_6.5rem_5rem_7rem] items-center px-3 py-2 text-xs gap-2 border-b border-border/50 last:border-0 bg-bg-surface">
                              <span class="font-mono text-accent-ui font-bold truncate">{{ item.productSku }}</span>
                              <span class="font-medium text-text-main truncate" [title]="item.productDisplayName">{{ item.productDisplayName }}</span>
                              <span class="text-right font-mono text-text-soft">{{ item.unitPrice | number: '1.2-2' }}</span>
                              <span class="text-right font-mono font-bold text-text-main">×{{ item.quantity }}</span>
                              <span class="text-right font-mono font-bold text-text-main">{{ item.finalPrice | number: '1.2-2' }}</span>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </li>
                }
              </ul>
            </div>
          }

          @if (c.movements.length > 0) {
            <div class="bg-bg-surface rounded-xl border border-border-strong overflow-hidden">
              <div class="px-6 pt-5 pb-3">
                <p class="section-title mb-0">Gastos del turno ({{ c.movements.length }})</p>
              </div>
              <div
                class="hidden lg:grid lg:grid-cols-4 px-6 py-2 bg-bg-muted border-y border-border text-[10px] font-bold uppercase tracking-wider text-text-soft"
              >
                <span>Tipo</span>
                <span>Descripción</span>
                <span class="text-right">Monto</span>
                <span class="text-right">Hora</span>
              </div>
              <ul class="flex flex-col">
                @for (m of c.movements; track m.id) {
                  <li
                    class="group bg-bg-surface border-b border-border last:border-b-0 transition-colors hover:bg-bg-muted/30"
                  >
                    <div class="flex items-center gap-4 px-6 py-3.5 lg:hidden">
                      <div class="flex flex-col min-w-0 flex-1">
                        <p class="text-sm font-semibold text-text-main">{{ m.description }}</p>
                        <p class="mt-0.5 text-xs text-text-muted">
                          <span
                            [class.text-feedback-error-text]="m.type === 'Outflow'"
                            [class.text-feedback-success-text]="m.type !== 'Outflow'"
                          >
                            {{ m.type === 'Outflow' ? 'Salida' : 'Entrada' }}
                          </span>
                          <span class="mx-1">·</span>
                          {{ m.createdAt | smartDate }}
                        </p>
                      </div>
                      <div class="shrink-0 text-right">
                        <span
                          class="text-sm font-mono font-bold"
                          [class.text-feedback-error-text]="m.type === 'Outflow'"
                          [class.text-feedback-success-text]="m.type !== 'Outflow'"
                        >
                          {{
                            (m.type === 'Outflow' ? -m.amount : m.amount)
                              | number: '1.2-2'
                          }}
                        </span>
                      </div>
                    </div>
                    <div
                      class="hidden lg:grid lg:grid-cols-4 items-center px-6 py-3 transition-colors hover:bg-bg-muted/30"
                    >
                      <span>
                        <span
                          class="text-[11px] font-bold px-2 py-0.5 rounded-md"
                          [class.text-feedback-error-text]="m.type === 'Outflow'"
                          [class.bg-feedback-error-bg]="m.type === 'Outflow'"
                          [class.text-feedback-success-text]="m.type !== 'Outflow'"
                          [class.bg-feedback-success-bg]="m.type !== 'Outflow'"
                        >
                          {{ m.type === 'Outflow' ? 'Salida' : 'Entrada' }}
                        </span>
                      </span>
                      <span class="text-[13px] text-text-main">{{ m.description }}</span>
                      <span
                        class="text-right text-[13px] font-mono font-bold"
                        [class.text-feedback-error-text]="m.type === 'Outflow'"
                        [class.text-feedback-success-text]="m.type !== 'Outflow'"
                      >
                        {{
                          (m.type === 'Outflow' ? -m.amount : m.amount)
                            | number: '1.2-2'
                        }}
                      </span>
                      <span class="text-right text-[13px] text-text-soft">{{ m.createdAt | smartDate }}</span>
                    </div>
                  </li>
                }
              </ul>
            </div>
          }

          @if (perm.can('sales', 'closures', 'update')) {
            <div class="bg-bg-surface rounded-xl border border-border-strong px-6 py-5">
              <p class="section-title mb-4">Cerrar turno</p>
              <div class="flex flex-col gap-4">
                <div class="flex flex-col sm:flex-row gap-4 items-start">
                  <div class="flex-1 max-w-xs">
                    <label class="field-label">Monto contado en caja</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      [value]="closingBalance() ?? ''"
                      (input)="onBalanceInput($any($event.target).value)"
                      (keydown)="blockKeys($event)"
                      class="field-number w-full px-4 py-2.5 text-lg font-mono font-bold border border-border rounded-xl bg-bg-surface text-text-main focus:outline-none focus:border-accent-ui"
                    />
                  </div>
                  <div class="flex-1 bg-accent-ui/10 border border-accent-ui/30 rounded-xl px-4 py-3 flex flex-col gap-1">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-accent-ui">Esperado</span>
                    <span class="text-xl font-black font-mono text-accent-ui">{{ expectedAmount() | number: '1.2-2' }}</span>
                    @if (closingBalance() !== null) {
                      <span class="text-xs font-mono" [class.text-feedback-success-text]="(closingBalance()! - expectedAmount()) === 0" [class.text-feedback-error-text]="(closingBalance()! - expectedAmount()) !== 0">
                        Dif: {{ (closingBalance()! - expectedAmount()) | number: '1.2-2' }}
                      </span>
                    }
                  </div>
                </div>
                <div class="flex gap-3">
                  <a
                    routerLink="/sales/pos"
                    class="px-6 py-2.5 border border-border rounded-xl text-sm font-semibold text-text-muted hover:bg-bg-muted transition-all"
                  >
                    Cancelar
                  </a>
                  <button
                    type="button"
                    (click)="confirmClose()"
                    [disabled]="closingBalance() === null || closingBalance()! < 0 || submitting()"
                    class="px-6 py-2.5 bg-accent-ui text-white rounded-xl text-sm font-bold hover:bg-accent-ui/90 disabled:opacity-40 transition-all flex items-center gap-2"
                  >
                    @if (submitting()) {
                      <span
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      ></span>
                    }
                    Confirmar Cierre
                  </button>
                </div>
                @if (closeError()) {
                  <p class="text-sm text-feedback-error-text">{{ closeError() }}</p>
                }
              </div>
            </div>
          }
        </div>

      }
    </div>

    <!-- Devolución: bottom-sheet en mobile, side-panel en desktop (fuera del contenedor animado para que el fixed use el viewport) -->
    @if (refundSaleId(); as rid) {
      <div class="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-overlay backdrop-blur-[1px]" (click)="closeRefund()"></div>
        <div class="relative z-10 w-full md:w-[600px] md:max-w-[90%] h-[92vh] md:h-screen bg-bg-surface rounded-t-2xl md:rounded-none md:border-l md:border-border md:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-fade-in">
          <app-return-refund class="flex-1 min-h-0 flex flex-col" [saleId]="rid" (closed)="closeRefund()" (refunded)="onRefunded()" />
        </div>
      </div>
    }
  `,
})
export default class CloseRegisterPage implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cashRegisterService = inject(CashRegisterService);
  private toast = inject(ToastService);
  readonly perm = inject(PermissionService);
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;
  protected isReturnType = isReturnType;
  protected isCashPayment = isCashPayment;

  state = signal<'init' | 'ready' | 'already-closed' | 'error'>('init');
  closure = signal<ClosureDetailDto | null>(null);
  closingBalance = signal<number | null>(null);
  submitting = signal(false);
  closeError = signal<string | null>(null);
  errorMessage = signal('');
  refundSaleId = signal<GUID | null>(null);

  expectedAmount = computed(() => {
    const c = this.closure();
    if (!c) return 0;
    return c.openingBalance + c.cashSales - c.totalExpenses;
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.refundSaleId.set(getModalId(params.get('modal'), 'return'));
    });
    this.loadClosure(true);
  }

  private loadClosure(initial = false): void {
    this.cashRegisterService.getCurrentDetails().subscribe({
      next: (c) => {
        this.closure.set(c);
        if (initial) this.state.set('ready');
      },
      error: (err) => {
        if (!initial) {
          this.toast.error('No se pudo actualizar los datos del turno.');
          return;
        }
        if (err?.status === 404) {
          this.state.set('already-closed');
          return;
        }
        this.errorMessage.set('Error al cargar los datos del turno.');
        this.state.set('error');
      },
    });
  }

  onBalanceInput(value: string): void {
    if (value === '' || value === null || value === undefined) {
      this.closingBalance.set(null);
      return;
    }
    const num = Number(value);
    this.closingBalance.set(Number.isFinite(num) ? num : null);
  }

  goToRefund(saleId: GUID): void {
    openModal(this.router, this.route, `return:${saleId}`);
  }

  closeRefund(): void {
    closeModal(this.router, this.route);
  }

  onRefunded(): void {
    closeModal(this.router, this.route);
    this.loadClosure();
  }

  confirmClose(): void {
    const bal = this.closingBalance();
    if (bal === null || bal < 0 || !Number.isFinite(bal) || this.submitting()) return;

    this.submitting.set(true);
    this.closeError.set(null);

    this.cashRegisterService.closeRegister({ RealCountedAmount: bal! }).subscribe({
      next: () => {
        this.toast.success('Caja cerrada');
        this.router.navigate(['/sales/pos']);
      },
      error: (err) => {
        this.submitting.set(false);
        const e = err as { error?: { detail?: string; title?: string; message?: string }; message?: string };
        const msg = e?.error?.detail || e?.error?.title || e?.error?.message || e?.message || 'Error al cerrar la caja. Intentá de nuevo.';
        this.closeError.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
