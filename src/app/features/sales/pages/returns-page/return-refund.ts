import { Component, computed, inject, input, output, signal, OnInit, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { form, validate, applyEach } from '@angular/forms/signals';
import { SaleService } from '@features/sales/services/sale-service';
import {
  CreateReturnItemDto,
  CreateReturnResponse,
  SaleForReturnDto,
  ReturnableItemDto,
} from '@features/sales/dtos/returns-dto';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { ToastService } from '@core/services/toast-service';

interface ReturnLine {
  saleItemId: GUID;
  productSku: string;
  productDisplayName: string;
  soldQuantity: number;
  returnableQuantity: number;
  unitPrice: number;
  selected: boolean;
  returnQuantity: number;
}

interface RefundFormModel {
  isFullReturn: boolean;
  lines: ReturnLine[];
}

@Component({
  selector: 'app-return-refund',
  imports: [MoneyPipe, SkeletonList, SmartDatePipe],
  styles: `
    @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .fade-up { animation: fade-up 240ms ease both; }
  `,
  template: `
    <div class="flex flex-col h-full">
      @if (loading()) {
        <div class="flex-1 flex items-center justify-center p-8">
          <app-skeleton-list [rows]="3" [columns]="2" />
        </div>
      } @else if (error()) {
        <div class="flex-1 flex flex-col items-center justify-center gap-3 p-8">
          <span class="material-icons text-4xl text-feedback-error-text">error_outline</span>
          <p class="text-sm font-medium text-text-muted max-w-sm text-center">{{ error() }}</p>
          <button type="button" (click)="goBack()" class="text-xs font-bold text-accent-ui hover:underline">Volver</button>
        </div>
      } @else if (detail(); as d) {
        <!-- Header -->
        <header class="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface shrink-0">
          <h2 class="text-sm font-bold text-text-main">Procesar devolución</h2>
          <button type="button" (click)="goBack()" class="btn-icon hover:bg-bg-muted" aria-label="Cerrar">
            <span class="material-icons text-base">close</span>
          </button>
        </header>

        <!-- Body scrollable -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Resumen venta -->
          <div class="bg-bg-muted/30 rounded-xl border border-border px-4 py-3">
            <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft mb-2">Venta seleccionada</p>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <p class="field-label">Fecha</p>
                <p class="field-value text-xs font-medium">{{ d.createdAt | smartDate }}</p>
              </div>
              <div>
                <p class="field-label">Vendedor</p>
                <p class="field-value text-xs font-medium truncate">{{ d.soldByName }}</p>
              </div>
              <div>
                <p class="field-label">Total</p>
                <p class="field-value text-xs font-bold font-mono">{{ d.totalAmount | money: 'symbol' }}</p>
              </div>
            </div>
          </div>

          <!-- Toggle reembolso completo -->
          <label class="flex items-center gap-3 bg-bg-surface rounded-xl border border-border px-4 py-3 cursor-pointer hover:bg-bg-muted/40 transition-colors select-none">
            <input type="checkbox" [checked]="refundModel().isFullReturn" (change)="onToggleFullReturn($event)" class="h-5 w-5 rounded border-border text-accent-ui focus:ring-accent-ui" />
            <div class="flex flex-col">
              <span class="text-sm font-bold text-text-main">Reembolso completo</span>
              <span class="text-xs text-text-soft">Todas las unidades ({{ maxRefundUnits() }} unid. · {{ maxRefundAmount() | money: 'symbol' }})</span>
            </div>
          </label>

          <!-- Ítems -->
          <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
            <div class="hidden lg:grid grid-cols-[7rem_6rem_1fr_7rem] pl-7 pr-3 py-2 bg-bg-muted border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-soft gap-2">
              <span class="text-center">Vendido / Disp.</span>
              <span class="text-right">Precio</span>
              <span class="text-center">A devolver</span>
              <span class="text-right">Subtotal</span>
            </div>
            <div class="lg:hidden px-4 py-3 bg-bg-muted border-b border-border flex items-center justify-between">
              <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">Artículos</p>
              <span class="text-xs text-text-soft">{{ d.items.length }} art.</span>
            </div>
            <ul class="flex flex-col divide-y divide-border">
              @for (line of refundModel().lines; track line.saleItemId; let i = $index) {
                <!-- Mobile -->
                <li class="lg:hidden px-4 py-3.5 flex flex-col gap-3" [class.bg-bg-muted/30]="refundModel().isFullReturn">
                  <label class="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" [checked]="line.selected" [disabled]="refundModel().isFullReturn" (change)="onToggleLine(i, $event)" class="mt-1 h-5 w-5 rounded border-border text-accent-ui focus:ring-accent-ui shrink-0 disabled:opacity-50" />
                    <div class="flex-1 min-w-0">
                      <p class="text-[15px] font-bold text-text-main break-words leading-snug">{{ line.productDisplayName }}</p>
                      <p class="font-mono text-xs font-bold tracking-wide text-accent-ui">{{ line.productSku }}</p>
                    </div>
                  </label>
                  <div class="flex flex-wrap items-center gap-2 pl-8">
                    <span class="px-2.5 py-1 rounded-md bg-bg-muted border border-border text-xs font-bold font-mono text-text-main">{{ line.soldQuantity }}/{{ line.returnableQuantity }} unid.</span>
                    <span class="text-xs text-text-soft">vendido / disp.</span>
                    <span class="px-2 py-1 rounded-md bg-bg-surface border border-border text-xs font-medium text-text-muted">{{ line.unitPrice | money: 'symbol' }} c/u</span>
                  </div>
                  <div class="flex items-center justify-between pl-8">
                    <div class="flex items-center gap-2">
                      <button type="button" (click)="dec(i)" [disabled]="!line.selected || refundModel().isFullReturn || line.returnQuantity <= 1" class="h-9 w-9 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-main disabled:opacity-30 hover:bg-bg-muted transition-colors">
                        <span class="material-icons text-base">remove</span>
                      </button>
                      <input type="number" [value]="line.returnQuantity" [disabled]="!line.selected || refundModel().isFullReturn" (input)="onQtyInput(i, $event)" class="w-16 px-2 py-2 text-center text-sm font-mono font-bold border rounded-lg bg-bg-surface text-text-main outline-none focus:border-accent-ui focus:ring-1 focus:ring-accent-ui disabled:bg-bg-muted disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <button type="button" (click)="inc(i)" [disabled]="!line.selected || refundModel().isFullReturn || line.returnQuantity >= line.returnableQuantity" class="h-9 w-9 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-main disabled:opacity-30 hover:bg-bg-muted transition-colors">
                        <span class="material-icons text-base">add</span>
                      </button>
                    </div>
                    <span class="text-sm font-mono font-black min-w-[5.5rem] text-right" [class.text-accent-ui]="line.returnQuantity > 0" [class.text-text-soft]="!line.selected">{{ (line.returnQuantity * line.unitPrice) | money: 'symbol' }}</span>
                  </div>
                </li>

                <!-- Desktop: 2 filas -->
                <li class="hidden lg:flex lg:flex-col gap-2 px-3 py-3" [class.bg-bg-muted/30]="refundModel().isFullReturn">
                  <div class="flex items-start gap-2 min-w-0">
                    <input type="checkbox" [checked]="line.selected" [disabled]="refundModel().isFullReturn" (change)="onToggleLine(i, $event)" class="mt-1 h-5 w-5 rounded border-border text-accent-ui focus:ring-accent-ui shrink-0 disabled:opacity-50" />
                    <div class="flex-1 min-w-0 flex flex-col">
                      <span class="font-mono text-xs font-bold tracking-wide text-accent-ui break-all">{{ line.productSku }}</span>
                      <p class="text-sm font-bold text-text-main break-words leading-snug" [title]="line.productDisplayName">{{ line.productDisplayName }}</p>
                    </div>
                  </div>
                  <div class="grid grid-cols-[7rem_6rem_1fr_7rem] items-center gap-2 pl-7">
                    <span class="text-center px-2 py-1 rounded-md bg-bg-muted border border-border text-xs font-bold font-mono text-text-main whitespace-nowrap">{{ line.soldQuantity }}/{{ line.returnableQuantity }} unid.</span>
                    <span class="text-right text-xs font-mono font-medium text-text-muted whitespace-nowrap">{{ line.unitPrice | money: 'symbol' }}</span>
                    <div class="flex items-center justify-center gap-1">
                      <button type="button" (click)="dec(i)" [disabled]="!line.selected || refundModel().isFullReturn || line.returnQuantity <= 1" class="h-7 w-7 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-main disabled:opacity-30 hover:bg-bg-muted transition-colors shrink-0">
                        <span class="material-icons text-sm">remove</span>
                      </button>
                      <input type="number" [value]="line.returnQuantity" [disabled]="!line.selected || refundModel().isFullReturn" (input)="onQtyInput(i, $event)" class="w-12 px-1 py-1 text-center text-sm font-mono font-bold border rounded-lg bg-bg-surface text-text-main outline-none focus:border-accent-ui focus:ring-1 focus:ring-accent-ui disabled:bg-bg-muted disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <button type="button" (click)="inc(i)" [disabled]="!line.selected || refundModel().isFullReturn || line.returnQuantity >= line.returnableQuantity" class="h-7 w-7 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-main disabled:opacity-30 hover:bg-bg-muted transition-colors shrink-0">
                        <span class="material-icons text-sm">add</span>
                      </button>
                    </div>
                    <span class="text-right text-sm font-mono font-bold whitespace-nowrap" [class.text-accent-ui]="line.returnQuantity > 0">{{ (line.returnQuantity * line.unitPrice) | money: 'symbol' }}</span>
                  </div>
                </li>
              }
            </ul>
          </div>

          <div class="rounded-xl border border-feedback-warning/40 bg-feedback-warning/10 px-4 py-3 text-xs text-feedback-warning-text">
            El reembolso se entrega en <span class="font-bold">efectivo</span> al cliente. Verificá el monto antes de confirmar.
          </div>
        </div>

        <!-- Footer fijo -->
        <footer class="shrink-0 border-t border-border bg-bg-surface p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex flex-col gap-1">
              <span class="text-[11px] font-bold uppercase tracking-wider text-text-soft">A devolver (efectivo)</span>
              <span class="text-2xl font-black font-mono" [class.text-accent-ui]="canProcess()" [class.text-text-soft]="!canProcess()">{{ totalRefund() | money: 'symbol' }}</span>
              <span class="text-xs text-text-soft">{{ activeLinesCount() }} art. · {{ totalUnits() }} unid.</span>
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold shrink-0" [class]="refundModel().isFullReturn ? 'bg-accent-ui text-white' : 'bg-bg-surface border border-border text-text-muted'">
              {{ refundModel().isFullReturn ? 'Completo' : 'Parcial' }}
            </span>
          </div>
          @if (!canProcess()) {
            <p class="text-xs text-feedback-warning-text">Seleccioná al menos 1 unidad</p>
          }
          <div class="flex gap-3">
            <button type="button" (click)="goBack()" class="flex-1 py-3 rounded-xl text-sm font-semibold border border-border bg-bg-surface text-text-muted hover:bg-bg-muted transition-colors">Cancelar</button>
            <button type="button" (click)="processReturn()" [disabled]="!canProcess() || processing()" class="flex-1 py-3 rounded-xl text-sm font-bold bg-btn-primary-bg text-btn-primary-text hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
              @if (processing()) {
                <span class="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                Procesando...
              } @else {
                Procesar devolución
              }
            </button>
          </div>
        </footer>
      }
    </div>
  `,
})
export default class ReturnRefund implements OnInit {
  private saleService = inject(SaleService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);

  saleId = input<GUID | null>(null);
  closed = output<void>();
  refunded = output<void>();

  detail = signal<SaleForReturnDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  processing = signal(false);

  // Signal Forms: el modelo es la única fuente de verdad
  refundModel = signal<RefundFormModel>({ isFullReturn: false, lines: [] });

  refundForm = form(this.refundModel, (s) => {
    applyEach(s.lines, (line) => {
      validate(line.returnQuantity, ({ value, valueOf }) => {
        if (valueOf(s.isFullReturn) === true) return null;
        if (!valueOf(line.selected)) return null;
        const v = value() ?? 0;
        const max = valueOf(line.returnableQuantity) ?? 0;
        if (v <= 0) return { kind: 'min', message: 'Debe ser al menos 1' };
        if (v > max) return { kind: 'max', message: `Máx. ${max} unid.` };
        return null;
      });
    });
    validate(s.lines, ({ value, valueOf }) => {
      if (valueOf(s.isFullReturn) === true) return null;
      const has = value().some((l) => l.selected && (l.returnQuantity ?? 0) > 0);
      if (!has) return { kind: 'empty', message: 'Seleccioná al menos 1 artículo' };
      return null;
    });
  });

  // Banner totales
  totalUnits = computed(() =>
    this.refundModel().isFullReturn
      ? this.refundModel().lines.reduce((sum, l) => sum + l.returnableQuantity, 0)
      : this.refundModel().lines.filter((l) => l.selected).reduce((sum, l) => sum + l.returnQuantity, 0),
  );

  totalRefund = computed(() =>
    this.refundModel().isFullReturn
      ? this.refundModel().lines.reduce((sum, l) => sum + l.returnableQuantity * l.unitPrice, 0)
      : this.refundModel().lines.filter((l) => l.selected).reduce((sum, l) => sum + l.returnQuantity * l.unitPrice, 0),
  );

  activeLinesCount = computed(() =>
    this.refundModel().isFullReturn
      ? this.refundModel().lines.filter((l) => l.returnableQuantity > 0).length
      : this.refundModel().lines.filter((l) => l.selected && l.returnQuantity > 0).length,
  );

  maxRefundUnits = computed(() => this.detail()?.items.reduce((sum, i) => sum + i.returnableQuantity, 0) ?? 0);
  maxRefundAmount = computed(() => this.detail()?.items.reduce((sum, i) => sum + i.returnableQuantity * i.unitPrice, 0) ?? 0);

  canProcess = computed(() => {
    if (!this.detail()) return false;
    if (this.refundModel().isFullReturn) return this.maxRefundUnits() > 0;
    return this.totalUnits() > 0 && this.refundModel().lines.every((l) => !l.selected || (l.returnQuantity > 0 && l.returnQuantity <= l.returnableQuantity));
  });

  constructor() {
    effect(() => {
      const id = this.saleId();
      if (id) this.loadRefund(id);
    });
  }

  ngOnInit(): void {
    const inputId = this.saleId();
    const routeId = this.route.snapshot.paramMap.get('saleId') ?? '';
    const saleId = inputId || routeId;
    if (!saleId) {
      // si es modal sin route param, espera al input
      if (!inputId) {
        this.error.set('Falta el ID de la venta.');
        this.loading.set(false);
      }
      return;
    }
    this.loadRefund(saleId);
  }

  private loadRefund(saleId: GUID): void {
    this.loading.set(true);
    this.error.set(null);
    this.saleService.getSaleForReturn(saleId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.refundModel.set({
          isFullReturn: false,
          lines: d.items.map((i: ReturnableItemDto) => ({
            saleItemId: i.saleItemId,
            productSku: i.productSku,
            productDisplayName: i.productDisplayName,
            soldQuantity: i.quantity,
            returnableQuantity: i.returnableQuantity,
            unitPrice: i.unitPrice,
            selected: false,
            returnQuantity: 0,
          })),
        });
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.friendlyLoadError(err));
        this.loading.set(false);
      },
    });
  }

  private friendlyLoadError(err: { status?: number; error?: { title?: string; detail?: string } }): string {
    const backendMsg =
      err?.error?.detail || err?.error?.title || (err?.status === 404 ? 'No se encontró una venta elegible.' : null);
    return backendMsg ?? 'Esta venta ya fue reembolsada o no es elegible para devolución.';
  }

  // ── Acciones del formulario (el modelo se actualiza acá, sin [formField]) ──

  onToggleFullReturn(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.refundModel.update((m) => ({
      isFullReturn: checked,
      lines: m.lines.map((l) =>
        checked
          ? { ...l, selected: true, returnQuantity: l.returnableQuantity }
          : { ...l, selected: false, returnQuantity: 0 },
      ),
    }));
  }

  onToggleLine(index: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.refundModel.update((m) => {
      const lines = m.lines.map((l, i) =>
        i === index
          ? { ...l, selected: checked, returnQuantity: checked ? Math.min(1, l.returnableQuantity) || 0 : 0 }
          : l,
      );
      return { ...m, lines };
    });
  }

  onQtyInput(index: number, event: Event): void {
    const raw = parseInt((event.target as HTMLInputElement).value, 10);
    const value = isNaN(raw) ? 0 : Math.max(0, Math.min(raw, this.refundModel().lines[index].returnableQuantity));
    this.refundModel.update((m) => {
      const lines = m.lines.map((l, i) =>
        i === index ? { ...l, returnQuantity: value, selected: value > 0 } : l,
      );
      return { ...m, lines };
    });
  }

  inc(index: number): void {
    const m = this.refundModel();
    if (m.isFullReturn || !m.lines[index]?.selected) return;
    this.refundModel.update((curr) => {
      const lines = curr.lines.map((l, i) =>
        i === index ? { ...l, returnQuantity: Math.min(l.returnableQuantity, l.returnQuantity + 1) } : l,
      );
      return { ...curr, lines };
    });
  }

  dec(index: number): void {
    const m = this.refundModel();
    if (m.isFullReturn || !m.lines[index]?.selected) return;
    this.refundModel.update((curr) => {
      const lines = curr.lines.map((l, i) =>
        i === index ? { ...l, returnQuantity: Math.max(1, l.returnQuantity - 1) } : l,
      );
      return { ...curr, lines };
    });
  }

  processReturn(): void {
    if (!this.canProcess()) return;
    const d = this.detail();
    if (!d || this.processing()) return;

    const m = this.refundModel();
    const items: CreateReturnItemDto[] = m.isFullReturn
      ? m.lines.filter((l) => l.returnableQuantity > 0).map((l) => ({ originalSaleItemId: l.saleItemId, quantity: l.returnableQuantity }))
      : m.lines.filter((l) => l.selected && l.returnQuantity > 0).map((l) => ({ originalSaleItemId: l.saleItemId, quantity: l.returnQuantity }));

    if (!items.length) return;

    this.processing.set(true);
    this.saleService.createReturn(d.id, { items }).subscribe({
      next: (res: CreateReturnResponse) => {
        this.processing.set(false);
        this.toastService.success(`Devolución ${res.returnNumber} procesada por Bs ${res.totalRefundAmount.toFixed(2)}`);
        if (this.saleId()) {
          this.refunded.emit();
          this.closed.emit();
        } else {
          this.router.navigate(['/sales/pos/returns'], {
            queryParams: { sku: this.route.snapshot.queryParamMap.get('sku') ?? undefined },
          });
        }
      },
      error: (err) => {
        this.processing.set(false);
        const msg = err?.error?.detail || err?.error?.title || 'Error al procesar la devolución. Intentá de nuevo.';
        this.toastService.error(msg);
      },
    });
  }

  goBack(): void {
    if (this.saleId()) {
      this.closed.emit();
      return;
    }
    if (window.history.length > 1) window.history.back();
    else this.router.navigate(['/sales/pos/returns']);
  }
}