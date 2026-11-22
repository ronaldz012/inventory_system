import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SaleService } from '@features/sales/services/sale-service';
import {
  CreateReturnDto,
  CreateReturnItemDto,
  CreateReturnResponse,
} from '@features/sales/dtos/returns-dto';
import { SaleDetailDto, SalePaymentLineDto } from '@features/sales/dtos/sale-detail-dto';
import { paymentMethodChipClass, paymentMethodLabel } from '@features/sales/models/payment-method';
import { RefundMethodPicker } from './refund-method-picker';
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
  /** Descuento por unidad: el subtotal a devolver lo descuenta. */
  discountAmount: number;
  selected: boolean;
  returnQuantity: number;
}

/**
 * Página de devolución (ruta `sales/pos/returns/:saleId`).
 *
 * Carga el detalle de la venta (el endpoint `returnable` quedó deprecado):
 * `canReturn` decide la elegibilidad y lo devolvible por línea se deriva como
 * `quantity − returnedQuantity`. Acá se marcan los ítems que vuelven (con
 * "Devolver todo" de atajo) y cómo se devuelve la plata mediante
 * `RefundMethodPicker` — el POST manda `payments[]` con montos positivos que
 * cierran contra `Σ (unitPrice − discount) × qty`.
 */
@Component({
  selector: 'app-return-refund',
  imports: [MoneyPipe, SkeletonList, SmartDatePipe, RefundMethodPicker],
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
    <div class="flex flex-col gap-4 fade-up">
      <!-- Header estándar: flecha atrás como el resto de las vistas -->
      <div class="flex items-center gap-3">
        <button type="button" (click)="goBack()" class="btn-icon">
          <span class="material-icons text-base">arrow_back</span>
        </button>
        <h1 class="text-lg font-black text-text-main">Procesar devolución</h1>
      </div>

      @if (loading()) {
        <app-skeleton-list [rows]="4" [columns]="2" />
      } @else if (error()) {
        <div
          class="flex flex-col items-center gap-3 p-8 rounded-xl border border-border bg-bg-surface shadow-sm"
        >
          <span class="material-icons text-3xl text-feedback-error-text">error_outline</span>
          <p class="text-sm font-medium text-text-muted max-w-sm text-center">{{ error() }}</p>
          <button type="button" (click)="goBack()" class="btn btn-primary btn-sm">Volver</button>
        </div>
      } @else if (detail(); as d) {
        <!-- Desktop: la venta a la izquierda, el pago a la derecha (sticky).
             Mobile: una sola columna con el pago pegado abajo. -->
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
          <div class="flex flex-col gap-4 min-w-0">
            <!-- Resumen: el Nº de la venta siempre visible, como en el detalle -->
            <div class="bg-bg-surface rounded-xl border border-border-strong px-4 py-3">
              <p class="text-sm font-semibold text-text-main mb-3">Venta #{{ d.number }}</p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <p class="field-label">Fecha</p>
                  <p class="text-xs font-medium">{{ d.createdAt | smartDate }}</p>
                </div>
                <div class="min-w-0">
                  <p class="field-label">Vendedor</p>
                  <p class="text-xs font-medium truncate" [title]="d.soldByName">
                    {{ d.soldByName }}
                  </p>
                </div>
                <div>
                  <p class="field-label">Total</p>
                  <p class="text-xs font-bold font-mono">{{ d.totalAmount | money: 'symbol' }}</p>
                </div>
              </div>
              <!-- Cómo pagó el cliente: contexto para decidir la devolución. -->
              <div
                class="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">
                  Pagó con
                </p>
                @for (p of d.payments; track $index) {
                  <span class="flex items-center gap-1.5">
                    <span class="shrink-0" [class]="paymentMethodChipClass(p.method)">{{
                      paymentMethodLabel(p.method)
                    }}</span>
                    <span class="text-sm font-bold font-mono text-text-main">{{
                      p.amount | money: 'symbol'
                    }}</span>
                  </span>
                }
              </div>
            </div>

            <!-- Ítems que vuelven -->
            <div class="bg-bg-surface rounded-xl border border-border overflow-hidden">
              <div
                class="px-4 py-3 bg-bg-muted border-b border-border flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">
                    Artículos que vuelven
                  </p>
                  <span class="text-xs text-text-soft">{{ d.items.length }}</span>
                </div>
                <button type="button" (click)="toggleAll()" class="btn btn-secondary btn-sm">
                  {{ allSelected() ? 'Limpiar' : 'Devolver todo' }}
                </button>
              </div>

              <ul class="flex flex-col divide-y divide-border">
                @for (line of lines(); track line.saleItemId; let i = $index) {
                  <li
                    class="flex items-start gap-3 px-4 py-3"
                    [class.opacity-50]="line.returnableQuantity === 0"
                  >
                    <input
                      type="checkbox"
                      [checked]="line.selected"
                      [disabled]="line.returnableQuantity === 0"
                      (change)="toggleLine(i, $event)"
                      class="mt-1 h-5 w-5 rounded border-border text-accent-ui focus:ring-accent-ui shrink-0 disabled:opacity-40"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-bold text-text-main break-words leading-snug">
                        {{ line.productDisplayName }}
                      </p>
                      @if (line.productSku) {
                        <p class="font-mono text-xs font-bold text-accent-ui break-all">
                          {{ line.productSku }}
                        </p>
                      } @else {
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded-md bg-feedback-warning/15 border border-feedback-warning/30 text-[10px] font-bold text-feedback-warning-text"
                          >Venta libre</span
                        >
                      }
                      <div class="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          class="px-2 py-0.5 rounded-md bg-bg-muted border border-border text-xs font-mono text-text-muted"
                          >{{ line.soldQuantity }}/{{ line.returnableQuantity }} unid.</span
                        >
                        <span
                          class="px-2 py-0.5 rounded-md bg-bg-surface border border-border text-xs font-medium text-text-muted"
                          >{{ line.unitPrice | money: 'symbol' }} c/u</span
                        >
                        @if (line.discountAmount > 0) {
                          <span
                            class="px-2 py-0.5 rounded-md bg-feedback-error-bg/10 border border-feedback-error/30 text-xs font-bold text-feedback-error-text"
                            >Desc. {{ line.discountAmount | money: 'symbol' }}</span
                          >
                        }
                      </div>
                    </div>

                    <div class="flex flex-col items-end gap-2 shrink-0">
                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="dec(i)"
                          [disabled]="!line.selected || line.returnQuantity <= 1"
                          class="h-9 w-9 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-main disabled:opacity-30 hover:bg-bg-muted transition-colors"
                        >
                          <span class="material-icons text-base">remove</span>
                        </button>
                        <input
                          type="number"
                          [value]="line.returnQuantity"
                          [disabled]="!line.selected"
                          (input)="onQtyInput(i, $event)"
                          class="w-14 px-1 py-2 text-center text-sm font-mono font-bold border rounded-lg bg-bg-surface text-text-main outline-none focus:border-accent-ui focus:ring-1 focus:ring-accent-ui disabled:bg-bg-muted disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          (click)="inc(i)"
                          [disabled]="
                            !line.selected || line.returnQuantity >= line.returnableQuantity
                          "
                          class="h-9 w-9 rounded-lg border border-border bg-bg-surface flex items-center justify-center text-text-main disabled:opacity-30 hover:bg-bg-muted transition-colors"
                        >
                          <span class="material-icons text-base">add</span>
                        </button>
                      </div>
                      <span
                        class="text-sm font-mono font-bold min-w-[5.5rem] text-right"
                        [class.text-accent-ui]="line.selected && line.returnQuantity > 0"
                        [class.text-text-soft]="!line.selected"
                        >{{ lineTotal(line) | money: 'symbol' }}</span
                      >
                    </div>
                  </li>
                }
              </ul>
            </div>
          </div>

          <!-- Pago: última sección del flujo en mobile (ítems → pago, sin
              sticky: la lista típica es corta); columna derecha sticky en
              desktop, donde la lista sí puede ser larga. -->
          <div
            class="lg:sticky lg:top-6 rounded-xl border border-border-strong bg-bg-surface shadow-xs px-4 py-3 flex flex-col gap-3"
          >
            <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">
              Venta #{{ d.number }}
            </p>
            <app-refund-method-picker
              [total]="totalRefund()"
              [suggested]="d.payments"
              [disabled]="totalUnits() === 0"
              (payments)="payments.set($event)"
              (valid)="paymentsValid.set($event)"
            />
            <div class="flex items-end justify-between gap-3">
              <div class="flex flex-col gap-0.5">
                <span class="text-[11px] font-bold uppercase tracking-wider text-text-soft"
                  >A devolver</span
                >
                <span
                  class="text-2xl font-black font-mono"
                  [class.text-accent-ui]="canProcess()"
                  [class.text-text-soft]="!canProcess()"
                  >{{ totalRefund() | money: 'symbol' }}</span
                >
                <span class="text-xs text-text-soft"
                  >{{ activeLinesCount() }} art. · {{ totalUnits() }} unid.</span
                >
              </div>
            </div>
            @if (!canProcess()) {
              <p class="text-xs font-bold text-feedback-warning-text">{{ processHint() }}</p>
            }
            <button
              type="button"
              (click)="processReturn()"
              [disabled]="!canProcess()"
              class="btn-primary w-full justify-center flex items-center gap-2"
            >
              @if (processing()) {
                <span
                  class="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                ></span>
                Procesando...
              } @else {
                Procesar devolución
              }
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export default class ReturnRefund implements OnInit {
  private saleService = inject(SaleService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);

  detail = signal<SaleDetailDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  processing = signal(false);

  /** Líneas elegidas y validez que emite el picker. */
  payments = signal<SalePaymentLineDto[]>([]);
  paymentsValid = signal(true);

  lines = signal<ReturnLine[]>([]);

  /** El template no puede llamar imports: se exponen tal cual. */
  readonly paymentMethodLabel = paymentMethodLabel;
  readonly paymentMethodChipClass = paymentMethodChipClass;

  ngOnInit(): void {
    const saleId = this.route.snapshot.paramMap.get('saleId');
    if (!saleId) {
      this.error.set('Falta el ID de la venta.');
      this.loading.set(false);
      return;
    }
    this.loadRefund(saleId);
  }

  private loadRefund(saleId: GUID): void {
    this.loading.set(true);
    this.error.set(null);
    this.saleService.getSaleDetail(saleId).subscribe({
      next: (d) => {
        // Elegibilidad: el detalle ya la expone (`canReturn`); sin ella no hay flujo.
        if (!d.canReturn) {
          this.detail.set(null);
          this.error.set('Esta venta ya fue devuelta o no es elegible para devolución.');
          this.loading.set(false);
          return;
        }
        this.detail.set(d);
        this.lines.set(
          d.items.map((i) => ({
            saleItemId: i.id,
            productSku: i.productSku,
            productDisplayName: i.productDisplayName,
            soldQuantity: i.quantity,
            // Derivado (mismo cálculo que el chip "N/M unid." del detalle):
            // lo devolvible por línea es lo que aún no se devolvió.
            returnableQuantity: i.quantity - (i.returnedQuantity ?? 0),
            unitPrice: i.unitPrice,
            discountAmount: i.discountAmount,
            selected: false,
            returnQuantity: 0,
          })),
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.friendlyLoadError(err));
        this.loading.set(false);
      },
    });
  }

  private friendlyLoadError(err: {
    status?: number;
    error?: { title?: string; detail?: string };
  }): string {
    const backendMsg =
      err?.error?.detail ||
      err?.error?.title ||
      (err?.status === 404 ? 'No se encontró la venta.' : null);
    return backendMsg ?? 'No se pudo cargar la venta. Intentá de nuevo.';
  }

  // ── Selección de ítems ──────────────────────────────────────────────────

  /** Subtotal a devolver por línea: el descuento por unidad se descuenta. */
  lineTotal(line: ReturnLine): number {
    if (!line.selected) return 0;
    return (line.unitPrice - line.discountAmount) * line.returnQuantity;
  }

  totalUnits = computed(() =>
    this.lines()
      .filter((l) => l.selected)
      .reduce((sum, l) => sum + l.returnQuantity, 0),
  );

  totalRefund = computed(() =>
    this.lines()
      .filter((l) => l.selected)
      .reduce((sum, l) => sum + this.lineTotal(l), 0),
  );

  activeLinesCount = computed(() => this.lines().filter((l) => l.selected).length);

  /** Todas las líneas devolvibles al máximo (para el atajo "Vuelve todo"). */
  allSelected = computed(
    () =>
      this.lines().length > 0 &&
      this.lines().every(
        (l) =>
          l.returnableQuantity === 0 || (l.selected && l.returnQuantity === l.returnableQuantity),
      ),
  );

  linesValid = computed(() =>
    this.lines().every(
      (l) => !l.selected || (l.returnQuantity > 0 && l.returnQuantity <= l.returnableQuantity),
    ),
  );

  canProcess = computed(
    () =>
      !!this.detail() &&
      !this.processing() &&
      this.totalUnits() > 0 &&
      this.linesValid() &&
      this.paymentsValid(),
  );

  processHint = computed(() => {
    if (this.totalUnits() === 0) return 'Seleccioná al menos 1 unidad';
    if (!this.paymentsValid()) return 'Los pagos separados deben sumar el total';
    return '';
  });

  toggleAll(): void {
    const clearing = this.allSelected();
    this.lines.update((ls) =>
      ls.map((l) =>
        clearing
          ? { ...l, selected: false, returnQuantity: 0 }
          : {
              ...l,
              selected: l.returnableQuantity > 0,
              returnQuantity: l.returnableQuantity > 0 ? l.returnableQuantity : 0,
            },
      ),
    );
  }

  toggleLine(index: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.lines.update((ls) =>
      ls.map((l, i) =>
        i === index
          ? {
              ...l,
              selected: checked,
              returnQuantity: checked ? Math.min(1, l.returnableQuantity) || 0 : 0,
            }
          : l,
      ),
    );
  }

  onQtyInput(index: number, event: Event): void {
    const raw = parseInt((event.target as HTMLInputElement).value, 10);
    const max = this.lines()[index]?.returnableQuantity ?? 0;
    const value = isNaN(raw) ? 0 : Math.max(0, Math.min(raw, max));
    this.lines.update((ls) =>
      ls.map((l, i) => (i === index ? { ...l, returnQuantity: value, selected: value > 0 } : l)),
    );
  }

  inc(index: number): void {
    this.lines.update((ls) =>
      ls.map((l, i) =>
        i === index
          ? { ...l, returnQuantity: Math.min(l.returnableQuantity, l.returnQuantity + 1) }
          : l,
      ),
    );
  }

  dec(index: number): void {
    this.lines.update((ls) =>
      ls.map((l, i) =>
        i === index ? { ...l, returnQuantity: Math.max(1, l.returnQuantity - 1) } : l,
      ),
    );
  }

  // ── Confirmación ────────────────────────────────────────────────────────

  processReturn(): void {
    const d = this.detail();
    if (!d || !this.canProcess()) return;

    const items: CreateReturnItemDto[] = this.lines()
      .filter((l) => l.selected && l.returnQuantity > 0)
      .map((l) => ({ originalSaleItemId: l.saleItemId, quantity: l.returnQuantity }));
    if (!items.length) return;

    const dto: CreateReturnDto = { items, payments: this.payments() };

    this.processing.set(true);
    this.saleService.createReturn(d.id, dto).subscribe({
      next: (res: CreateReturnResponse) => {
        this.processing.set(false);
        this.toastService.success(
          `Devolución ${res.returnNumber} procesada por Bs ${res.totalRefundAmount.toFixed(2)}`,
        );
        // Vuelve al detalle que ya quedó atrás en el historial: pop de esta
        // página sin duplicar la entrada del detalle (se recrea, recarga solo
        // y muestra el banner de la devolución nueva). Deep link sin historia
        // → al detalle con replaceUrl.
        if (window.history.length > 1) window.history.back();
        else this.router.navigate(['/sales/sale', d.id], { replaceUrl: true });
      },
      error: (err) => {
        this.processing.set(false);
        const msg =
          err?.error?.detail ||
          err?.error?.title ||
          'Error al procesar la devolución. Intentá de nuevo.';
        this.toastService.error(msg);
      },
    });
  }

  goBack(): void {
    // Patrón estándar del app (como el goBack del detalle): atrás real si hay
    // historia — la página anterior es el detalle de esta venta.
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    // Deep link / recarga sin historia: al detalle si lo tenemos, si no al listado.
    const id = this.detail()?.id;
    if (id) this.router.navigate(['/sales/sale', id], { replaceUrl: true });
    else this.router.navigate(['/sales/sales']);
  }
}
