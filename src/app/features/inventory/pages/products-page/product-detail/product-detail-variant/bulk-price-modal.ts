import { Component, computed, input, output, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ProductVariantDto } from '../../../../dtos/products/product-detail-dto';
import { BulkUpdateVariantPriceItem } from '../../../../dtos/products/bulk-update-variant-price-dto';

interface PriceRow {
  id: GUID;
  sku: string;
  size: string;
  color: string;
  currentPrice: number;
  selected: boolean;
  newPrice: number | null;
}

const MIN_PRICE = 0.01;

/**
 * Edición masiva de precios de las variantes de un producto (panel lateral).
 *
 * Uso:
 *   @if (showBulkPrices() && product()) {
 *     <app-bulk-price-modal
 *       [variants]="product()!.variants"
 *       [submitting]="submitting()"
 *       (save)="onBulkPricesSave($event)"
 *       (close)="closeModal()"
 *     />
 *   }
 *
 * Inicialización: si todas las variantes tienen el mismo precio, el toggle
 * "Precio igual para todas" arranca activado y prellenado. Si difieren,
 * arranca apagado con edición por fila; al activarlo el input único queda
 * vacío para obligar un valor explícito (sin overwrite silencioso).
 */
@Component({
  selector: 'app-bulk-price-modal',
  imports: [CurrencyPipe],
  template: `
    <div
      class="fixed inset-y-0 right-0 z-[100] flex flex-col bg-bg-surface font-inter animate-fade-in w-full md:w-[640px] md:max-w-[95%] md:border-l md:border-border md:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.15)]"
    >
      <!-- ── HEADER ── -->
      <header class="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="pill-info">Precios</span>
          <span class="text-[13px] font-semibold text-text-main truncate">
            Editar precios · {{ rows().length }}
            {{ rows().length === 1 ? 'talla/color' : 'tallas/colores' }}
          </span>
        </div>
        <button
          type="button"
          (click)="close.emit()"
          class="btn-icon hover:bg-bg-muted hover:text-text-main"
          aria-label="Cerrar panel"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      <!-- ── MAIN ── -->
      <main class="flex-1 overflow-y-auto p-4 space-y-4">
        <p class="text-xs text-text-soft">Los cambios aplican a ventas futuras. El historial conserva sus precios.</p>

        <!-- PRECIO ÚNICO -->
        <section class="space-y-3">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <h3 class="section-title">Precio</h3>
            <div class="flex items-center gap-3 bg-bg-muted/60 px-3 py-1.5 rounded-lg border border-border">
              <div class="flex items-center gap-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    class="sr-only peer"
                    [checked]="samePriceForAll()"
                    (change)="onToggleSame($event)"
                  />
                  <div
                    class="w-9 h-5 bg-bg-muted rounded-full peer peer-checked:bg-accent-ui peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                  ></div>
                </label>
                <span class="text-[10px] font-medium text-text-soft uppercase tracking-wider"
                  >Precio igual</span
                >
              </div>
              @if (samePriceForAll()) {
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-1.5">
                    <input
                      type="number"
                      placeholder="0.00"
                      [value]="uniquePrice() ?? ''"
                      (input)="onUniqueInput($event)"
                      [class.!border-feedback-error-text]="uniqueTouched() && !isUniqueValid()"
                      class="w-24 px-1.5 py-0.5 border border-border rounded text-[11px] font-mono font-bold text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span class="text-[10px] text-text-soft">Todas las filas usan este precio</span>
                  </div>
                  @if (uniqueTouched() && !isUniqueValid()) {
                    <span class="text-[9px] text-feedback-error-text font-medium leading-none">
                      Ingresá un precio válido (mín. Bs 0.01).
                    </span>
                  }
                </div>
              }
            </div>
          </div>

          <div class="border border-border rounded-xl bg-bg-surface shadow-sm overflow-hidden">
            <div
              class="hidden md:grid grid-cols-[28px_8rem_1fr_6rem_8rem] bg-bg-muted border-b border-border"
            >
              <div class="px-2 py-2"></div>
              <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft">
                SKU
              </div>
              <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft">
                Talla / Color
              </div>
              <div
                class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft text-right"
              >
                Actual
              </div>
              <div
                class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft text-right"
              >
                Nuevo
              </div>
            </div>

            <!-- Filas -->
            <div class="flex flex-col">
              @for (row of rows(); track row.id; let i = $index) {
                <div
                  class="flex flex-col md:grid md:grid-cols-[28px_8rem_1fr_6rem_8rem] md:items-center border-b border-border last:border-b-0 transition-colors"
                >
                  <!-- Mobile card top | Desktop: cols 1-3 via md:contents -->
                  <div class="flex items-center gap-2 px-3 py-1.5 md:p-0 md:contents">
                    <div class="flex justify-center w-7 shrink-0 md:w-auto md:py-2">
                      <input
                        type="checkbox"
                        [checked]="row.selected"
                        (change)="onToggleRow(i, $event)"
                        class="accent-accent-ui cursor-pointer w-3.5 h-3.5"
                      />
                    </div>

                    <div
                      class="text-[11px] font-mono font-bold text-accent-ui truncate min-w-0 flex-1 md:flex-none md:px-3 md:py-2"
                    >
                      {{ row.sku }}
                    </div>

                    <div
                      class="text-[11px] text-text-main truncate min-w-0 flex-[2] md:flex-none md:px-3 md:py-2"
                    >
                      {{ row.size }} / {{ row.color }}
                    </div>
                  </div>

                  <!-- Mobile card bottom | Desktop: cols 4-5 via md:contents -->
                  <div
                    class="flex items-center gap-2 px-3 py-1.5 border-t border-border/40 md:border-t-0 md:p-0 md:contents"
                  >
                    <div
                      class="text-[11px] font-mono text-text-soft shrink-0 md:px-3 md:py-2 md:text-right"
                    >
                      {{ row.currentPrice | currency: 'BOB' : 'symbol' : '1.2-2' }}
                    </div>

                    <div class="flex-1 min-w-0 md:px-2 md:py-2">
                      @if (samePriceForAll()) {
                        <span class="block text-[11px] font-mono font-bold text-text-main text-right">
                          → {{ effectivePrice(row) | currency: 'BOB' : 'symbol' : '1.2-2' }}
                        </span>
                      } @else {
                        <input
                          type="number"
                          [value]="row.newPrice ?? ''"
                          [disabled]="!row.selected"
                          placeholder="0.00"
                          (input)="onRowPriceInput(i, $event)"
                          [class.!border-feedback-error-text]="row.selected && !isRowValid(row)"
                          class="w-full px-1.5 py-0.5 border border-border rounded text-[11px] font-mono font-bold text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui disabled:bg-bg-muted disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none md:text-right"
                        />
                        @if (row.selected && !isRowValid(row)) {
                          <span
                            class="block w-full text-[9px] text-feedback-error-text font-medium leading-none mt-0.5 md:text-right"
                            >Mín. Bs 0.01</span
                          >
                        }
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      </main>

      <!-- ── FOOTER ── -->
      <footer class="border-t border-border bg-bg-surface p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0">
        <div class="w-full mx-auto flex flex-wrap items-center justify-end gap-3">
          @if (selectedCount() === 0) {
            <span class="text-[11px] text-feedback-warning-text font-medium mr-auto">Seleccioná al menos 1 talla/color.</span>
          } @else if (samePriceForAll() && isUniqueValid()) {
            <span class="text-[11px] text-text-muted mr-auto">
              <strong class="text-text-main">{{ selectedCount() }}</strong> a
              <strong class="text-accent-ui font-mono">{{ (uniquePrice() ?? 0) | currency: 'BOB' : 'symbol' : '1.2-2' }}</strong> c/u
            </span>
          } @else if (!samePriceForAll()) {
            <span class="text-[11px] text-text-muted mr-auto">
              <strong class="text-text-main">{{ selectedCount() }}</strong>
              {{ selectedCount() === 1 ? 'talla/color' : 'tallas/colores' }} con precios individuales
            </span>
          }
          <button type="button" (click)="close.emit()" class="btn btn-secondary btn-sm">Cancelar</button>
          <button
            type="button"
            (click)="onSave()"
            [disabled]="!canSave() || submitting()"
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
  variants = input.required<ProductVariantDto[]>();
  submitting = input<boolean>(false);

  save = output<BulkUpdateVariantPriceItem[]>();
  close = output<void>();

  rows = signal<PriceRow[]>([]);
  samePriceForAll = signal(false);
  uniquePrice = signal<number | null>(null);
  uniqueTouched = signal(false);

  selectedCount = computed(() => this.rows().filter((r) => r.selected).length);

  isUniqueValid = computed(() => {
    const v = this.uniquePrice();
    return v != null && v >= MIN_PRICE;
  });

  canSave = computed(() => {
    const selected = this.rows().filter((r) => r.selected);
    if (selected.length === 0) return false;
    if (this.samePriceForAll()) return this.isUniqueValid();
    return selected.every((r) => this.isRowValid(r));
  });

  ngOnInit(): void {
    const variants = this.variants();
    const prices = variants.map((v) => Math.round(v.price * 100));
    const allEqual = prices.length > 0 && prices.every((p) => p === prices[0]);

    this.rows.set(
      variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        currentPrice: v.price,
        selected: true,
        newPrice: v.price,
      })),
    );
    this.samePriceForAll.set(allEqual);
    this.uniquePrice.set(allEqual && variants.length > 0 ? variants[0].price : null);
  }

  isRowValid(row: PriceRow): boolean {
    return row.newPrice != null && row.newPrice >= MIN_PRICE;
  }

  effectivePrice(row: PriceRow): number | null {
    return this.samePriceForAll() ? this.uniquePrice() : row.newPrice;
  }

  onToggleSame(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.samePriceForAll.set(checked);
    // Al unificar precios distintos, exigir valor explícito (sin overwrite silencioso)
    if (checked) {
      const selected = this.rows().filter((r) => r.selected).map((r) => Math.round((r.newPrice ?? r.currentPrice) * 100));
      const uniform = selected.length > 0 && selected.every((p) => p === selected[0]);
      this.uniquePrice.set(uniform ? selected[0] / 100 : null);
      this.uniqueTouched.set(false);
    }
  }

  onUniqueInput(event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    this.uniquePrice.set(isNaN(raw) ? null : raw);
    this.uniqueTouched.set(true);
  }

  onToggleRow(index: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, selected: checked } : r)));
  }

  onRowPriceInput(index: number, event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    const value = isNaN(raw) ? null : raw;
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, newPrice: value } : r)));
  }

  onSave(): void {
    if (!this.canSave()) return;
    const same = this.samePriceForAll();
    const items: BulkUpdateVariantPriceItem[] = this.rows()
      .filter((r) => r.selected)
      .map((r) => ({
        variantId: r.id,
        price: same ? this.uniquePrice()! : r.newPrice!,
      }));
    if (items.length > 0) this.save.emit(items);
  }
}
