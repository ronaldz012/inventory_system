import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SaleService } from '@features/sales/services/sale-service';
import { DocumentType, PaymentMethod, SaleDetailDto, SaleType } from '@features/sales/dtos/sale-detail-dto';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';

@Component({
  selector: 'app-sale-detail-page',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, SkeletonList, SmartDatePipe],
  styles: `
    @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .fade-up { animation: fade-up 240ms ease both; }
  `,
  template: `
    <div class="max-w-5xl mx-auto fade-up">
      @if (loading()) {
        <app-skeleton-list [rows]="3" [columns]="2" />
      } @else if (!sale()) {
        <div class="flex flex-col items-center gap-3 p-12 rounded-xl border border-border bg-bg-surface shadow-xs">
          <span class="material-icons text-4xl text-text-soft opacity-60">receipt</span>
          <p class="text-sm font-medium text-text-muted">Venta no encontrada.</p>
          <a routerLink="/sales/sales" class="text-xs font-bold text-accent-ui hover:underline">Volver a ventas</a>
        </div>
      } @else {
        @let s = sale()!;
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <button type="button" (click)="goBack()" class="btn-icon">
              <span class="material-icons text-base">arrow_back</span>
            </button>
            <h1 class="text-lg font-black text-text-main">{{ isReturn() ? 'Detalle de Devolución' : 'Detalle de Venta' }}</h1>
            <span class="ml-2 px-2.5 py-1 rounded-full text-xs font-bold"
              [class]="isReturn() ? 'bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30' : 'bg-accent-ui/10 text-accent-ui'">
              {{ isReturn() ? 'Devolución' : 'Venta' }}
            </span>
          </div>

          <!-- Banner venta con devoluciones -->
          @if (!isReturn() && hasReturns()) {
            <div class="rounded-xl border border-feedback-warning/40 bg-feedback-warning/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex flex-col gap-1">
                <span class="text-[11px] font-bold uppercase tracking-wider text-feedback-warning-text">Esta venta tiene devoluciones</span>
                <span class="text-sm font-semibold text-text-main">{{ returnsCount() }} devolución(es) · {{ totalRefunded() | currency: 'BOB' : 'symbol' : '1.2-2' }} reembolsado</span>
              </div>
              <a (click)="scrollToReturns()" class="text-xs font-bold text-accent-ui hover:underline cursor-pointer">Ver devoluciones ↓</a>
            </div>
          }

          <!-- Banner devolución vinculada -->
          @if (isReturn() && s.originalSaleId) {
            <div class="rounded-xl border border-accent-ui/30 bg-accent-ui/10 px-5 py-4 flex items-center justify-between gap-3">
              <div class="flex flex-col gap-1">
                <span class="text-[11px] font-bold uppercase tracking-wider text-accent-ui">Devolución vinculada</span>
                <span class="text-sm font-medium text-text-main">Venta original: <span class="font-mono text-xs">{{ s.originalSaleId }}</span></span>
              </div>
              <a [routerLink]="['/sales/sale', s.originalSaleId]" class="btn-link">
                <span class="btn-link-text">Ver venta original</span>
                <span class="material-icons text-base">chevron_right</span>
              </a>
            </div>
          }

          <div class="bg-bg-surface rounded-xl border border-border-strong px-4 py-3">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-text-main">
                {{ isReturn() ? 'Devolución' : 'Venta' }} #{{ s.number }}
              </p>
              <span
                class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold shrink-0"
                [class]="
                  isReturn()
                    ? 'bg-feedback-warning/15 text-feedback-warning-text'
                    : 'bg-accent-ui/10 text-accent-ui'
                "
                >{{ isReturn() ? 'Devolución' : 'Venta' }}</span
              >
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <p class="table-header">Total</p>
                <p
                  class="text-xl font-black font-mono"
                  [class.text-feedback-error-text]="isReturn()"
                  [class.text-text-main]="!isReturn()"
                >
                  {{ s.totalAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}
                </p>
              </div>
              <div>
                <p class="table-header">Fecha</p>
                <p class="text-sm font-bold text-text-main">{{ s.createdAt | smartDate }}</p>
              </div>
              <div class="min-w-0">
                <p class="table-header">Vendedor</p>
                <p class="text-sm font-bold text-text-main truncate" [title]="s.soldByName">
                  {{ s.soldByName }}
                </p>
              </div>
              <div>
                <p class="table-header">Artículos</p>
                <p class="text-sm font-bold font-mono text-text-main">
                  {{ s.totalItems }} <span class="text-xs font-bold">u</span>
                </p>
              </div>
              <div>
                <p class="table-header">Método de pago</p>
                <p class="text-sm font-bold">
                  @if (s.paymentMethod === PaymentMethod.Cash) {
                    <span class="text-xs font-medium text-text-muted bg-bg-muted px-2 py-0.5 rounded-md">Efectivo</span>
                  } @else {
                    <span class="text-xs font-medium text-feedback-info-text bg-feedback-info-bg/10 px-2 py-0.5 rounded-md">Pago Móvil</span>
                  }
                </p>
              </div>
              <div>
                <p class="table-header">Tipo de documento</p>
                <p class="text-sm font-bold">
                  @if (s.documentType === DocumentType.Invoice) {
                    <span class="text-xs font-medium text-feedback-success-text bg-feedback-success-bg/10 px-2 py-0.5 rounded-md">Factura</span>
                  } @else if (s.documentType === DocumentType.PendingInvoice) {
                    <span class="text-xs font-medium text-feedback-warning-text bg-feedback-warning-bg/15 px-2 py-0.5 rounded-md">Pendiente</span>
                  } @else {
                    <span class="text-xs font-medium text-text-soft bg-bg-muted px-2 py-0.5 rounded-md">Boleta</span>
                  }
                </p>
              </div>
              <div>
                <p class="table-header">N° Factura</p>
                <p class="text-sm font-bold font-mono text-text-main">{{ s.invoiceNumber ?? '—' }}</p>
              </div>
              <div class="min-w-0">
                <p class="table-header">Código de transacción</p>
                <p class="text-sm font-bold font-mono text-text-main truncate" [title]="s.transactionCode || ''">{{ s.transactionCode || '—' }}</p>
              </div>
            </div>
            @if (s.notes) {
              <p class="text-[13px] text-text-muted leading-snug mt-1 break-words">{{ s.notes }}</p>
            }
          </div>

          <div class="bg-bg-surface rounded-xl border border-border-strong shadow-xs overflow-hidden">
            <div class="px-6 py-4 flex items-center justify-between">
              <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Artículos</p>
              <span class="text-xs text-text-soft">{{ s.items.length }} art.</span>
            </div>

            <!-- MOBILE -->
            <ul class="flex flex-col divide-y divide-border md:hidden">
              @for (item of s.items; track item.id) {
                <li class="flex flex-col gap-2 px-6 py-4" [class.bg-feedback-warning/5]="item.returnedQuantity > 0">
                  <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-[15px] font-bold text-text-main break-words leading-snug">{{ item.productDisplayName }}</p>
                      <p class="font-mono text-xs font-bold tracking-wide text-accent-ui">{{ item.productSku }}</p>
                    </div>
                    <div class="shrink-0 text-right">
                      <p class="text-sm font-semibold tabular-nums text-text-main">
                        {{ item.quantity }}<span class="text-xs font-normal text-text-soft"> uds</span>
                      </p>
                      <p class="text-xs font-mono text-text-soft">{{ item.unitPrice | currency: 'BOB' : 'symbol' : '1.2-2' }} c/u</p>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="px-2 py-0.5 rounded-md bg-bg-muted border border-border text-xs font-mono font-medium text-text-muted">
                      {{ netQuantity(item) }}/{{ item.quantity }} unid.
                    </span>
                    @if (item.returnedQuantity > 0) {
                      <span class="px-2 py-0.5 rounded-md bg-feedback-warning/15 border border-feedback-warning/30 text-xs font-bold text-feedback-warning-text">
                        {{ item.returnedQuantity }} devuelto
                      </span>
                    }
                    <span class="text-xs font-mono text-text-soft">Costo {{ item.unitCost | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                  </div>
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="text-feedback-success-text">Margen {{ ((item.unitPrice - (item.unitCost ?? 0))) * item.quantity | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                    @if (item.discountAmount) {
                      <span class="text-feedback-error-text">Desc. {{ item.discountAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                    }
                    <span class="font-bold text-text-main">{{ item.finalPrice | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
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
                    <th class="text-right py-2.5 px-3">Costo</th>
                    <th class="text-right py-2.5 px-3">P. Unitario</th>
                    <th class="text-center py-2.5 px-3">Cant.</th>
                    <th class="text-center py-2.5 px-3">Devuelto</th>
                    <th class="text-right py-2.5 px-3">Margen</th>
                    <th class="text-right py-2.5 px-3">Descuento</th>
                    <th class="text-right py-2.5 pr-6">Subtotal</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (item of s.items; track item.id) {
                    <tr [class.bg-feedback-warning/5]="item.returnedQuantity > 0">
                      <td class="py-2.5 pl-6 pr-4 font-mono text-xs text-text-muted">{{ item.productSku }}</td>
                      <td class="py-2.5 pr-4 text-text-main font-medium break-words max-w-[22rem]">{{ item.productDisplayName }}</td>
                      <td class="py-2.5 px-3 text-right text-text-soft font-mono tabular-nums">{{ item.unitCost | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                      <td class="py-2.5 px-3 text-right text-text-muted font-mono tabular-nums">{{ item.unitPrice | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                      <td class="py-2.5 px-3 text-center font-mono tabular-nums">
                        <span class="px-2 py-0.5 rounded-md bg-bg-muted border border-border text-xs font-bold">{{ item.quantity }}</span>
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        @if (item.returnedQuantity > 0) {
                          <span class="px-2 py-0.5 rounded-md bg-feedback-warning/15 border border-feedback-warning/30 text-xs font-bold text-feedback-warning-text">{{ item.returnedQuantity }}</span>
                        } @else {
                          <span class="text-xs text-text-soft">—</span>
                        }
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono tabular-nums text-feedback-success-text">{{ ((item.unitPrice - (item.unitCost ?? 0))) * item.quantity | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                      <td class="py-2.5 px-3 text-right text-feedback-error-text font-mono tabular-nums">{{ item.discountAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                      <td class="py-2.5 pr-6 text-right font-mono font-bold text-text-main tabular-nums">{{ item.finalPrice | currency: 'BOB' : 'symbol' : '1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="px-6 py-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-bg-muted/30">
              <span class="text-xs text-text-soft">{{ s.totalItems }} unid. en total @if (hasReturns()) { · {{ totalReturnedUnits() }} devuelto(s) · neto {{ netUnits() }} unid. }</span>
              <span class="text-sm font-bold font-mono text-text-main">{{ s.totalAmount | currency: 'BOB' : 'symbol' : '1.2-2' }} @if (hasReturns()) { <span class="text-xs font-normal text-feedback-warning-text">· reembolsado {{ totalRefunded() | currency: 'BOB' : 'symbol' : '1.2-2' }}</span> }</span>
            </div>
          </div>

          @if (hasReturns()) {
            <div id="returns-section" class="bg-bg-surface rounded-xl border border-border-strong shadow-xs overflow-hidden">
              <div class="px-6 py-4 bg-bg-muted border-b border-border flex items-center justify-between">
                <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Devoluciones</p>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30">{{ returnsCount() }}</span>
              </div>
              <ul class="flex flex-col divide-y divide-border">
                @for (r of s.returns; track r.id) {
                  <li class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-3.5 hover:bg-bg-muted/40 transition-colors">
                    <div class="flex flex-col gap-1 min-w-0">
                      <span class="font-mono text-xs font-bold text-text-main">{{ r.returnNumber ?? r.id.slice(0,8) }}</span>
                      <span class="text-xs text-text-soft">{{ r.createdAt | smartDate }}</span>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                      <span class="text-sm font-mono font-bold text-feedback-warning-text">{{ r.totalAmount | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
                      <a [routerLink]="['/sales/sale', r.id]" class="btn-link">
                        <span class="btn-link-text">Ver</span>
                        <span class="material-icons text-base">chevron_right</span>
                      </a>
                    </div>
                  </li>
                }
              </ul>
              <div class="px-6 py-3 bg-bg-muted/30 border-t border-border flex justify-between items-center">
                <span class="text-xs font-medium text-text-soft">Total reembolsado</span>
                <span class="text-sm font-black font-mono text-feedback-warning-text">{{ totalRefunded() | currency: 'BOB' : 'symbol' : '1.2-2' }}</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export default class SaleDetailPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private saleService = inject(SaleService);

  sale = signal<SaleDetailDto | null>(null);
  loading = signal(true);

  SaleType = SaleType;
  DocumentType = DocumentType;
  PaymentMethod = PaymentMethod;

  isReturn = computed(() => this.sale()?.type === SaleType.Return || this.sale()?.type as unknown === 'Return');
  hasReturns = computed(() => (this.sale()?.returns?.length ?? 0) > 0);
  returnsCount = computed(() => this.sale()?.returns.length ?? 0);
  totalRefunded = computed(() => this.sale()?.returns.reduce((sum, r) => sum + r.totalAmount, 0) ?? 0);
  totalReturnedUnits = computed(() => this.sale()?.items.reduce((sum, i) => sum + (i.returnedQuantity ?? 0), 0) ?? 0);
  netUnits = computed(() => (this.sale()?.totalItems ?? 0) - this.totalReturnedUnits());

  netQuantity = (item: { quantity: number; returnedQuantity: number }) => item.quantity - (item.returnedQuantity ?? 0);

  scrollToReturns(): void {
    document.getElementById('returns-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  goBack(): void {
    if (window.history.length > 1) window.history.back();
    else this.router.navigate(['sales', 'sales']);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadDetail(id);
  }

  private loadDetail(id: string): void {
    this.loading.set(true);
    this.saleService.getSaleDetail(id).subscribe({
      next: (s) => {
        this.sale.set(s as SaleDetailDto);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
