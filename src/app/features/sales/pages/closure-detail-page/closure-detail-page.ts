import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { ClosureDetailDto } from '@features/sales/dtos/closure-detail-dto';
import { isReturnType, isCashPayment } from '@features/sales/dtos/sale-detail-dto';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';

@Component({
  selector: 'app-closure-detail-page',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, SkeletonList, SmartDatePipe],
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
      @if (loading()) {
        <app-skeleton-list [rows]="3" [columns]="2" />
      } @else if (!closure()) {
        <div
          class="flex flex-col items-center gap-3 p-12 rounded-xl border border-border bg-bg-surface shadow-xs"
        >
          <span class="material-icons text-4xl text-text-soft opacity-60">payments</span>
          <p class="text-sm font-medium text-text-muted">Cierre no encontrado.</p>
          <a routerLink="/sales/closures" class="text-xs font-medium text-accent-ui hover:underline"
            >Volver a cierres</a
          >
        </div>
      } @else {
        @let c = closure()!;
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <button type="button" (click)="goBack()" class="btn-icon">
              <span class="material-icons text-base">arrow_back</span>
            </button>
            <h1 class="text-lg font-black text-text-main">Detalle de Cierre</h1>
          </div>

           <div class="bg-bg-surface rounded-xl border border-border-strong px-4 py-3">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-text-main">Cierre #{{ c.number }}</p>
              <span
                class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold shrink-0"
                [class.bg-feedback-success]="c.difference === 0"
                [class.text-feedback-success-text]="c.difference === 0"
                [class.bg-feedback-error]="c.difference !== 0"
                [class.text-feedback-error-text]="c.difference !== 0"
                >@if (c.difference === 0) {
                  Cuadra
                } @else {
                  Dif {{ c.difference | currency: 'BOB' : 'symbol' : '1.2-2' }}
                }</span
              >
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <p class="table-header">Diferencia</p>
                <p
                  class="text-xl font-black font-mono"
                  [class.text-feedback-success-text]="c.difference === 0"
                  [class.text-feedback-error-text]="c.difference !== 0"
                >
                  @if (c.difference === 0) {
                    Cuadra
                  } @else {
                    {{ c.difference | currency: 'BOB' : 'symbol' : '1.2-2' }}
                  }
                </p>
              </div>
              <div>
                <p class="table-header">Total ventas</p>
                <p class="text-sm font-bold font-mono text-text-main">
                  {{ c.totalSales | currency: 'BOB' : 'symbol' : '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Ventas efectivo</p>
                <p class="text-sm font-bold font-mono text-text-main">
                  {{ c.cashSales | currency: 'BOB' : 'symbol' : '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Total gastos</p>
                <p class="text-sm font-bold font-mono text-feedback-error-text">
                  {{ c.totalExpenses | currency: 'BOB' : 'symbol' : '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Apertura</p>
                <p class="text-sm font-bold text-text-main">{{ c.openedAt | smartDate }}</p>
              </div>
              <div>
                <p class="table-header">Cierre</p>
                <p class="text-sm font-bold text-text-main">
                  {{ c.closedAt ? (c.closedAt | smartDate) : '—' }}
                </p>
              </div>
              <div class="min-w-0">
                <p class="table-header">Turno</p>
                <p class="text-sm font-bold text-text-main truncate" [title]="c.openedByName + ' → ' + (c.closedByName || '—')">
                  {{ c.openedByName }} → {{ c.closedByName || '—' }}
                </p>
              </div>
              <div>
                <p class="table-header">Monto apertura</p>
                <p class="text-sm font-bold font-mono text-text-main">
                  {{ c.openingBalance | currency: 'BOB' : 'symbol' : '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Saldo esperado</p>
                <p class="text-sm font-bold font-mono text-text-main">
                  {{ c.systemSalesAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Monto contado</p>
                <p class="text-sm font-bold font-mono text-text-main">
                  {{ c.realCountedAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}
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
              <div class="hidden lg:grid lg:grid-cols-[9rem_8rem_6rem_7rem_6rem] px-6 py-2 bg-bg-muted border-y border-border text-[10px] font-bold uppercase tracking-wider text-text-soft">
                <span>Hora</span>
                <span class="text-right">Monto</span>
                <span class="text-center">Tipo</span>
                <span class="text-center">Pago</span>
                <span class="text-right">Artículos</span>
              </div>
              <ul class="flex flex-col divide-y divide-border">
                @for (sale of c.sales; track sale.id) {
                  <li class="bg-bg-surface">
                    <!-- Mobile card -->
                    <div class="lg:hidden px-4 py-4 flex flex-col gap-3">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-bold text-text-main font-mono">{{ sale.createdAt | smartDate }}</span>
                        <span class="text-sm font-mono font-black text-text-main">{{ sale.totalAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
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
                        <span class="text-xs text-text-soft truncate">· {{ sale.soldByName }}</span>
                      </div>
                      @if (sale.items.length > 0) {
                        <ul class="flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
                          @for (item of sale.items; track item.productVariantId) {
                            <li class="px-3 py-2.5 flex flex-col gap-1 bg-bg-surface">
                              <span class="font-mono text-[11px] font-bold tracking-wide text-accent-ui">{{ item.productSku }}</span>
                              <p class="text-[13px] font-semibold text-text-main break-words leading-snug">{{ item.productDisplayName }}</p>
                              <div class="flex flex-wrap items-center gap-2 text-xs">
                                <span class="px-2 py-0.5 rounded-md bg-bg-muted border border-border font-mono font-medium text-text-main">×{{ item.quantity }} · {{ item.finalPrice | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                                <span class="text-text-soft font-mono">costo {{ item.unitCost | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                                <span class="font-mono font-bold" [class.text-feedback-success-text]="((item.unitPrice - (item.unitCost ?? 0)) * item.quantity) > 0">{{ ((item.unitPrice - (item.unitCost ?? 0))) * item.quantity | currency: 'BOB' : 'symbol' : '1.2-2' }} margen</span>
                              </div>
                            </li>
                          }
                        </ul>
                      }
                    </div>
                    <!-- Desktop -->
                    <div class="hidden lg:block">
                      <div class="grid lg:grid-cols-[9rem_8rem_6rem_7rem_6rem] items-center px-6 py-3 hover:bg-bg-muted/30 transition-colors">
                        <span class="text-[13px] text-text-main font-mono">{{ sale.createdAt | smartDate }}</span>
                        <span class="text-right text-[13px] font-mono font-bold text-text-main" [class.text-feedback-warning-text]="isReturnType(sale.type)">{{ sale.totalAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
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
                      </div>
                      @if (sale.items.length > 0) {
                        <div class="mx-6 mb-3 rounded-lg border border-border bg-bg-muted/30 overflow-hidden">
                          <div class="grid lg:grid-cols-[8rem_1fr_6rem_6rem_7rem] px-3 py-1.5 bg-bg-muted border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-soft">
                            <span>SKU</span><span>Producto</span><span class="text-right">Costo</span><span class="text-right">Margen</span><span class="text-right">Subtotal</span>
                          </div>
                          @for (item of sale.items; track item.productVariantId) {
                            <div class="grid lg:grid-cols-[8rem_1fr_6rem_6rem_7rem] items-center px-3 py-2 text-xs gap-2 border-b border-border/50 last:border-0 bg-bg-surface">
                              <span class="font-mono text-accent-ui font-bold truncate">{{ item.productSku }}</span>
                              <span class="font-medium text-text-main truncate" [title]="item.productDisplayName">{{ item.productDisplayName }}</span>
                              <span class="text-right font-mono text-text-soft">{{ item.unitCost | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                              <span class="text-right font-mono font-bold text-feedback-success-text">{{ ((item.unitPrice - (item.unitCost ?? 0))) * item.quantity | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                              <span class="text-right font-mono font-bold text-text-main">×{{ item.quantity }} · {{ item.finalPrice | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
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
            <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
              <div class="px-6 pt-5 pb-3">
                <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Movimientos ({{ c.movements.length }})</p>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-[10px] font-bold uppercase tracking-wider text-text-soft border-y border-border bg-bg-muted">
                      <th class="text-left py-2.5 pl-6 pr-4">Tipo</th>
                      <th class="text-left py-2.5 pr-4">Descripción</th>
                      <th class="text-right py-2.5 px-4">Monto</th>
                      <th class="text-right py-2.5 pr-6">Hora</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    @for (m of c.movements; track m.id) {
                      <tr class="hover:bg-bg-muted/30 transition-colors">
                        <td class="py-2.5 pl-6 pr-4">
                          <span class="text-[11px] font-bold px-2 py-0.5 rounded-md" [class.text-feedback-error-text]="m.type === 'Outflow'" [class.bg-feedback-error-bg]="m.type === 'Outflow'" [class.text-feedback-success-text]="m.type !== 'Outflow'" [class.bg-feedback-success-bg]="m.type !== 'Outflow'">
                            {{ m.type === 'Outflow' ? 'Salida' : 'Entrada' }}
                          </span>
                        </td>
                        <td class="py-2.5 pr-4 text-sm text-text-main">{{ m.description }}</td>
                        <td class="py-2.5 px-4 text-right text-sm font-mono font-bold" [class.text-feedback-error-text]="m.type === 'Outflow'" [class.text-feedback-success-text]="m.type !== 'Outflow'">
                          {{ (m.type === 'Outflow' ? -m.amount : m.amount) | currency: 'BOB' : 'symbol' : '1.2-2' }}
                        </td>
                        <td class="py-2.5 pr-6 text-right text-sm text-text-soft">{{ m.createdAt | smartDate }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          @if (c.variantStocks.length) {
            <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
              <div class="px-6 pt-5 pb-3 flex items-center justify-between">
                <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Stock actual para reposición ({{ c.variantStocks.length }})</p>
                <span class="text-xs font-bold text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md">{{ c.variantStocks.length }} art.</span>
              </div>

              <!-- MOBILE -->
              <ul class="flex flex-col divide-y divide-border md:hidden">
                @for (v of c.variantStocks; track v.productVariantId) {
                  <li class="flex items-center gap-3 px-6 py-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-text-main truncate">
                        {{ v.productDisplayName }}
                      </p>
                      <p class="field-label">
                        <span class="font-mono text-text-muted">{{ v.productSku }}</span>
                      </p>
                    </div>
                    <div class="shrink-0 text-right">
                      <p
                        class="text-sm font-bold tabular-nums"
                        [class.text-feedback-error-text]="v.currentStock <= 0"
                        [class.text-feedback-warning-text]="
                          v.currentStock > 0 && v.currentStock <= 5
                        "
                        [class.text-text-main]="v.currentStock > 5"
                      >
                        {{ v.currentStock }}
                        <span class="text-xs font-normal text-text-soft">uds</span>
                      </p>
                    </div>
                  </li>
                }
              </ul>

              <!-- DESKTOP -->
              <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-[10px] font-bold uppercase tracking-wider text-text-soft border-y border-border bg-bg-muted">
                      <th class="text-left py-2.5 pl-6 pr-4">SKU</th>
                      <th class="text-left py-2.5 pr-4">Producto</th>
                      <th class="text-right py-2.5 pr-6">Stock</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border">
                    @for (v of c.variantStocks; track v.productVariantId) {
                      <tr class="hover:bg-bg-muted/30 transition-colors">
                        <td class="py-2.5 pl-6 pr-4 font-mono text-xs text-text-muted">
                          {{ v.productSku }}
                        </td>
                        <td class="py-2.5 pr-4 text-text-main font-medium">
                          {{ v.productDisplayName }}
                        </td>
                        <td
                          class="py-2.5 pr-6 text-right text-sm font-mono font-bold"
                          [class.text-feedback-error-text]="v.currentStock <= 0"
                          [class.text-feedback-warning-text]="
                            v.currentStock > 0 && v.currentStock <= 5
                          "
                          [class.text-text-main]="v.currentStock > 5"
                        >
                          {{ v.currentStock }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class ClosureDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cashRegisterService = inject(CashRegisterService);
  protected isReturnType = isReturnType;
  protected isCashPayment = isCashPayment;

  closure = signal<ClosureDetailDto | null>(null);
  loading = signal(true);

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['sales', 'closures']);
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadDetail(id);
  }

  private loadDetail(id: string): void {
    this.loading.set(true);
    this.cashRegisterService.getClosureDetail(id, true).subscribe({
      next: (c) => {
        this.closure.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
