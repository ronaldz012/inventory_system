import { Component, computed, effect, input, output, signal } from '@angular/core';
import { PaymentMethod, paymentMethodLabel } from '@features/sales/models/payment-method';
import { SalePaymentLineDto } from '@features/sales/dtos/sale-detail-dto';
import { MoneyPipe } from '@shared/pipes/money-pipe';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Elige cómo se devuelve la plata: un método (precargado con el dominante de
 * la venta original) o "pago separado" (split) con montos por método.
 *
 * Los botones replican el selector del POS (efectivo primero, mismo estilo)
 * para que el vendedor reconozca el patrón. Emite `payments` (montos
 * positivos, sin métodos duplicados) y `valid` (la suma cierra exacta contra
 * `total`). Mismo modelo que el payload del POS: cuando este habilite split
 * (fase 2) se reusa este patrón o componente.
 */
@Component({
  selector: 'app-refund-method-picker',
  imports: [MoneyPipe],
  template: `
    <div class="flex flex-col gap-2" [class.opacity-50]="disabled()">
      <label class="field-label uppercase font-bold tracking-wide">Cómo se devuelve</label>

      <div class="flex flex-wrap items-center gap-3">
        @if (!split()) {
          <div class="grid grid-cols-2 gap-3 flex-1 min-w-[17rem]">
            <button
              type="button"
              (click)="select(PaymentMethod.Cash)"
              [disabled]="disabled()"
              class="flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              [class.border-accent-ui]="method() === PaymentMethod.Cash"
              [class.bg-bg-muted]="method() === PaymentMethod.Cash"
              [class.text-accent-ui]="method() === PaymentMethod.Cash"
              [class.border-border]="method() !== PaymentMethod.Cash"
              [class.text-text-muted]="method() !== PaymentMethod.Cash"
            >
              <span class="material-icons text-[24px]">payments</span>
              Efectivo
            </button>
            <button
              type="button"
              (click)="select(PaymentMethod.QrCode)"
              [disabled]="disabled()"
              class="flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              [class.border-accent-ui]="method() === PaymentMethod.QrCode"
              [class.bg-bg-muted]="method() === PaymentMethod.QrCode"
              [class.text-accent-ui]="method() === PaymentMethod.QrCode"
              [class.border-border]="method() !== PaymentMethod.QrCode"
              [class.text-text-muted]="method() !== PaymentMethod.QrCode"
            >
              <span class="material-icons text-[24px]">qr_code</span>
              Pago QR
            </button>
          </div>
        }
        <label
          class="flex items-center gap-2 px-2 py-2 cursor-pointer select-none text-sm font-medium text-text-muted"
        >
          <input
            type="checkbox"
            [checked]="split()"
            [disabled]="disabled()"
            (change)="onToggleSplit($event)"
            class="h-5 w-5 rounded border-border text-accent-ui focus:ring-accent-ui disabled:opacity-60"
          />
          Pago separado
        </label>
      </div>

      @if (split()) {
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1">
            <span class="text-xs font-bold text-text-muted">{{
              paymentMethodLabel(PaymentMethod.Cash)
            }}</span>
            <input
              type="number"
              inputmode="decimal"
              min="0"
              step="0.5"
              [value]="cashAmount()"
              [disabled]="disabled()"
              (input)="onAmount('cash', $event)"
              class="w-full px-3 py-2 text-sm font-mono font-bold border rounded-lg bg-bg-surface text-text-main outline-none focus:border-accent-ui focus:ring-1 focus:ring-accent-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs font-bold text-text-muted">{{
              paymentMethodLabel(PaymentMethod.QrCode)
            }}</span>
            <input
              type="number"
              inputmode="decimal"
              min="0"
              step="0.5"
              [value]="qrAmount()"
              [disabled]="disabled()"
              (input)="onAmount('qr', $event)"
              class="w-full px-3 py-2 text-sm font-mono font-bold border rounded-lg bg-bg-surface text-text-main outline-none focus:border-accent-ui focus:ring-1 focus:ring-accent-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </label>
        </div>
        @if (remaining() !== 0) {
          <p class="text-xs font-bold text-feedback-warning-text">
            {{ remaining() > 0 ? 'Faltan' : 'Sobran' }} {{ abs(remaining()) | money: 'symbol' }}
          </p>
        }
      }
    </div>
  `,
})
export class RefundMethodPicker {
  /** Total exacto a devolver: la suma de los montos debe cerrar contra esto. */
  total = input.required<number>();
  /** Sugerencia precargada: las líneas de pago de la venta original. */
  suggested = input.required<SalePaymentLineDto[]>();
  /** Sin ítems seleccionados el panel no participa: atenuado y bloqueado. */
  disabled = input(false);

  /** Líneas elegidas (montos positivos, sin métodos duplicados). */
  payments = output<SalePaymentLineDto[]>();
  /** `true` cuando la suma cierra exacta contra `total`. */
  valid = output<boolean>();

  readonly PaymentMethod = PaymentMethod;
  readonly paymentMethodLabel = paymentMethodLabel;

  split = signal(false);
  method = signal<PaymentMethod>(PaymentMethod.Cash);
  qrAmount = signal(0);
  cashAmount = signal(0);

  /** Una vez que el vendedor elige método, la sugerencia no lo pisa. */
  private methodTouched = false;
  /** Ídem con los montos del split: sin tipear se re-espejan al cambiar el total. */
  private splitDirty = false;

  constructor() {
    // Precarga el método dominante de la venta original cuando llega la sugerencia.
    effect(() => {
      if (this.methodTouched) return;
      const dominant = [...this.suggested()].sort(
        (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
      )[0];
      this.method.set(dominant?.method ?? PaymentMethod.Cash);
    });
    // El total sigue a la lista: el split sin editar se re-espeja solo;
    // si el vendedor tipeó montos, se respetan y el hint guía a cerrar.
    effect(() => {
      const total = this.total();
      if (this.split() && !this.splitDirty) this.mirrorSuggestion(total);
    });
    // Emite el estado a la página ante cualquier cambio (incluido el total).
    effect(() => {
      this.payments.emit(this.currentPayments());
      this.valid.emit(this.sumCloses());
    });
  }

  /** Montos elegidos: sin split, un solo tender con el total completo. */
  currentPayments = computed<SalePaymentLineDto[]>(() => {
    if (!this.split()) return [{ method: this.method(), amount: round2(this.total()) }];
    return [
      { method: PaymentMethod.Cash, amount: this.cashAmount() },
      { method: PaymentMethod.QrCode, amount: this.qrAmount() },
    ].filter((p) => p.amount > 0);
  });

  sumCloses = computed(() => {
    if (!this.split()) return true;
    const lines = this.currentPayments();
    const sum = lines.reduce((a, p) => a + p.amount, 0);
    return lines.length > 0 && Math.abs(sum - this.total()) < 0.005;
  });

  /** Diferencia pendiente en modo split (0 cuando cierra). */
  remaining = computed(() =>
    this.split() ? round2(this.total() - (this.qrAmount() + this.cashAmount())) : 0,
  );

  abs = (n: number): number => Math.abs(n);

  select(method: PaymentMethod): void {
    this.methodTouched = true;
    this.method.set(method);
  }

  onToggleSplit(event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.split.set(on);
    if (on) this.mirrorSuggestion(this.total());
  }

  onAmount(which: 'qr' | 'cash', event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    const value = Math.max(0, isNaN(raw) ? 0 : raw);
    this.splitDirty = true;
    if (which === 'qr') this.qrAmount.set(value);
    else this.cashAmount.set(value);
  }

  /**
   * Espejo proporcional de la venta original escalado al total a devolver.
   * La pierna de efectivo absorbe el redondeo para que la suma cierre exacta.
   */
  private mirrorSuggestion(total: number): void {
    const sugg = this.suggested();
    const suggTotal = sugg.reduce((a, p) => a + Math.abs(p.amount), 0);
    let qr = 0;
    let cash = 0;
    for (const p of sugg) {
      const part = suggTotal > 0 ? (Math.abs(p.amount) / suggTotal) * total : 0;
      if (p.method === PaymentMethod.QrCode) qr += part;
      else cash += part;
    }
    this.qrAmount.set(round2(qr));
    this.cashAmount.set(Math.max(0, round2(round2(total) - round2(qr))));
  }
}
