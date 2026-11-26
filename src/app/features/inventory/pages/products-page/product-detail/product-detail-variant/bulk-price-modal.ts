import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { ProductVariantDto } from '../../../../dtos/products/product-detail-dto';
import { BulkUpdateVariantPriceItem } from '../../../../dtos/products/bulk-update-variant-price-dto';

/** Fórmula base aplicada a todas las filas; cada fila puede pisarla. */
type PriceMode = 'set' | 'amount' | 'percent';
type Rounding = 'none' | 'integer' | 'five';

interface PriceRow {
  id: GUID;
  sku: string;
  size: string;
  color: string;
  currentPrice: number;
  /** Precio tipeado por fila: gana sobre la fórmula. */
  override: number | null;
}

const MIN_PRICE = 0.01;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Edición masiva de precios (panel lateral).
 *
 * La selección se hace en el LISTA (checkboxes) y llega por input; acá solo
 * se decide la fórmula y se confirma:
 *
 *   Fijar    → todas al mismo precio.
 *   +/− Bs   → monto absoluto sobre el precio actual (ej: +10).
 *   +/− %    → porcentaje sobre el precio actual.
 *
 * Cada fila muestra la vista previa actual → nuevo y acepta un override
 * individual. El payload lleva precios finales explícitos (la preview ES lo
 * que se manda: sin deriva de redondeo contra el backend).
 */
@Component({
  selector: 'app-bulk-price-modal',
  imports: [MoneyPipe],
  template: `
    <div
      class="fixed inset-y-0 right-0 z-[100] flex flex-col bg-bg-surface font-inter animate-fade-in w-full md:w-[640px] md:max-w-[95%] md:border-l md:border-border md:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.15)]"
    >
      <!-- ── HEADER ── -->
      <header
        class="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="pill-info">Precios</span>
          <span class="text-[13px] font-semibold text-text-main truncate">
            {{ rows().length }} {{ rows().length === 1 ? 'talla/color' : 'tallas/colores' }}
          </span>
        </div>
        <button
          type="button"
          (click)="close.emit()"
          class="btn-icon hover:bg-bg-muted hover:text-text-main"
          aria-label="Cerrar panel"
        >
          <span class="material-icons text-base">close</span>
        </button>
      </header>

      <!-- ── MAIN ── -->
      <main class="flex-1 overflow-y-auto p-4 space-y-4">
        <p class="text-xs text-text-soft">
          Los cambios aplican a ventas futuras. El historial conserva sus precios.
        </p>

        <!-- FÓRMULA -->
        <section class="space-y-2">
          <h3 class="section-title">Fórmula</h3>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-1 bg-bg-muted rounded-lg p-1">
              <button
                type="button"
                (click)="mode.set('set')"
                class="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                [class]="
                  mode() === 'set'
                    ? 'bg-bg-surface text-accent-ui shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                "
              >
                Fijar
              </button>
              <button
                type="button"
                (click)="mode.set('amount')"
                class="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                [class]="
                  mode() === 'amount'
                    ? 'bg-bg-surface text-accent-ui shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                "
              >
                +/− Bs
              </button>
              <button
                type="button"
                (click)="mode.set('percent')"
                class="px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                [class]="
                  mode() === 'percent'
                    ? 'bg-bg-surface text-accent-ui shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                "
              >
                +/− %
              </button>
            </div>

            @if (mode() !== 'set') {
              <button
                type="button"
                (click)="flipDirection()"
                class="h-8 w-8 rounded-lg border border-border bg-bg-surface font-mono font-black text-base transition-colors"
                [class]="
                  direction() === 1 ? 'text-feedback-success-text' : 'text-feedback-error-text'
                "
                [title]="direction() === 1 ? 'Sumar' : 'Restar'"
                [attr.aria-label]="direction() === 1 ? 'Sumar' : 'Restar'"
              >
                {{ direction() === 1 ? '+' : '−' }}
              </button>
            }

            <input
              type="number"
              inputmode="decimal"
              [min]="mode() === 'set' ? MIN_PRICE : 0"
              [value]="value() ?? ''"
              (input)="onValueInput($event)"
              placeholder="0.00"
              class="w-28 px-2 py-1.5 border border-border rounded-lg text-sm font-mono font-bold text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />

            @if (mode() !== 'set') {
              <select
                [value]="rounding()"
                (change)="onRoundingChange($event)"
                class="px-2 py-1.5 border border-border rounded-lg text-xs font-medium text-text-muted bg-bg-surface focus:outline-none focus:border-accent-ui"
                aria-label="Redondeo"
              >
                <option value="none">Sin redondeo</option>
                <option value="integer">Entero</option>
                <option value="five">Múltiplo de 5</option>
              </select>
            }
          </div>
          <p class="text-xs text-text-soft">{{ modeHint() }}</p>
        </section>

        <!-- VISTA PREVIA: actual → nuevo (editable por fila) -->
        <section class="space-y-2">
          <h3 class="section-title">Vista previa</h3>
          <div class="border border-border rounded-xl bg-bg-surface shadow-sm overflow-hidden">
            <div class="flex flex-col">
              @for (row of rows(); track row.id) {
                <div
                  class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border last:border-b-0 transition-colors hover:bg-bg-muted/40"
                >
                  <span
                    class="text-[11px] font-mono font-bold text-accent-ui truncate min-w-0 w-24"
                  >
                    {{ row.sku }}
                  </span>
                  <span class="text-[11px] text-text-main truncate min-w-0 flex-1">
                    {{ row.size }} / {{ row.color }}
                  </span>
                  <span class="text-[11px] font-mono text-text-soft shrink-0">
                    {{ row.currentPrice | money: 'symbol' }}
                  </span>
                  <span class="material-icons text-sm text-text-soft shrink-0">arrow_forward</span>
                  <input
                    type="number"
                    inputmode="decimal"
                    [min]="MIN_PRICE"
                    [value]="effectivePrice(row)"
                    (input)="onRowInput(row, $event)"
                    [class.!border-feedback-error-text]="effectivePrice(row) < MIN_PRICE"
                    class="w-24 px-1.5 py-0.5 border border-border rounded text-[11px] font-mono font-bold text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    [attr.aria-label]="'Nuevo precio de ' + row.sku"
                  />
                </div>
              }
            </div>
          </div>
        </section>
      </main>

      <!-- ── FOOTER ── -->
      <footer
        class="border-t border-border bg-bg-surface p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0"
      >
        <div class="w-full mx-auto flex flex-wrap items-center justify-end gap-3">
          @if (!canSave()) {
            <span class="text-[11px] text-feedback-warning-text font-medium mr-auto">
              {{ saveHint() }}
            </span>
          } @else {
            <span class="text-[11px] text-text-muted mr-auto">
              Min
              <strong class="font-mono text-text-main">{{ minPrice() | money: 'symbol' }}</strong>
              · Máx
              <strong class="font-mono text-text-main">{{ maxPrice() | money: 'symbol' }}</strong>
            </span>
          }
          <button type="button" (click)="close.emit()" class="btn btn-secondary btn-sm">
            Cancelar
          </button>
          <button
            type="button"
            (click)="onSave()"
            [disabled]="!canSave()"
            class="btn btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            @if (submitting()) {
              Aplicando...
            } @else {
              Aplicar precios
            }
          </button>
        </div>
      </footer>
    </div>
  `,
})
export class BulkPriceModal implements OnInit {
  readonly MIN_PRICE = MIN_PRICE;

  /** Las variantes ya seleccionadas en la lista (la selección vive afuera). */
  variants = input.required<ProductVariantDto[]>();
  submitting = input<boolean>(false);

  save = output<BulkUpdateVariantPriceItem[]>();
  close = output<void>();

  rows = signal<PriceRow[]>([]);
  mode = signal<PriceMode>('set');
  /** Valor de la fórmula: precio final (set), monto o porcentaje. */
  value = signal<number | null>(null);
  /** +/− para monto y porcentaje. */
  direction = signal<1 | -1>(1);
  rounding = signal<Rounding>('none');

  valueValid = computed(() => {
    const v = this.value();
    if (v == null) return false;
    return this.mode() === 'set' ? v >= MIN_PRICE : v >= 0;
  });

  /** Sin fórmula válida también se puede si CADA fila fue tipeada a mano. */
  allOverridden = computed(() => this.rows().every((r) => r.override != null));

  rowsValid = computed(() => this.rows().every((r) => this.effectivePrice(r) >= MIN_PRICE));

  canSave = computed(() => (this.valueValid() || this.allOverridden()) && this.rowsValid());

  minPrice = computed(() =>
    this.rows().reduce((min, r) => Math.min(min, this.effectivePrice(r)), Number.POSITIVE_INFINITY),
  );
  maxPrice = computed(() =>
    this.rows().reduce((max, r) => Math.max(max, this.effectivePrice(r)), 0),
  );

  modeHint = computed(() => {
    switch (this.mode()) {
      case 'set':
        return 'Todas quedan al precio indicado.';
      case 'amount':
        return this.direction() === 1
          ? 'Suma el monto al precio actual de cada fila.'
          : 'Resta el monto al precio actual de cada fila.';
      case 'percent':
        return this.direction() === 1
          ? 'Aumenta el precio actual en este porcentaje.'
          : 'Reduce el precio actual en este porcentaje.';
    }
  });

  saveHint = computed(() => {
    if (this.rows().length === 0) return 'Sin tallas/colores seleccionadas.';
    if (!this.valueValid() && !this.allOverridden())
      return 'Poné un valor de fórmula o tipeá el precio de cada fila.';
    return 'Revisá los precios: el mínimo es Bs 0.01.';
  });

  ngOnInit(): void {
    const variants = this.variants();
    this.rows.set(
      variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        currentPrice: v.price,
        override: null,
      })),
    );
    // Conveniencia: si todas valen lo mismo, la fórmula arranca con ese precio.
    const prices = variants.map((v) => Math.round(v.price * 100));
    const allEqual = prices.length > 0 && prices.every((p) => p === prices[0]);
    if (allEqual) this.value.set(variants[0].price);
  }

  /** Resultado de la fórmula para una fila (sin override). */
  basePrice(row: PriceRow): number {
    const v = this.value();
    if (v == null) return row.currentPrice;
    switch (this.mode()) {
      case 'set':
        return v;
      case 'amount':
        return this.round(row.currentPrice + this.direction() * v);
      case 'percent':
        return this.round(row.currentPrice * (1 + (this.direction() * v) / 100));
    }
  }

  /** Precio final de la fila: el tipeo manual gana a la fórmula. */
  effectivePrice(row: PriceRow): number {
    return row.override ?? this.basePrice(row);
  }

  private round(n: number): number {
    switch (this.rounding()) {
      case 'integer':
        return Math.round(n);
      case 'five':
        return Math.round(n / 5) * 5;
      default:
        return round2(n);
    }
  }

  flipDirection(): void {
    this.direction.update((d) => (d === 1 ? -1 : 1));
  }

  onValueInput(event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    this.value.set(isNaN(raw) ? null : raw);
  }

  onRoundingChange(event: Event): void {
    this.rounding.set((event.target as HTMLSelectElement).value as Rounding);
  }

  onRowInput(row: PriceRow, event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    this.rows.update((rows) =>
      rows.map((r) =>
        r.id === row.id ? { ...r, override: isNaN(raw) ? null : Math.max(0, raw) } : r,
      ),
    );
  }

  onSave(): void {
    if (!this.canSave()) return;
    // La preview ES el payload: precios finales explícitos, sin deriva.
    const items: BulkUpdateVariantPriceItem[] = this.rows().map((r) => ({
      variantId: r.id,
      price: round2(this.effectivePrice(r)),
    }));
    this.save.emit(items);
  }
}
