import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { blockNonNumericKeys } from '@shared/utils/list-query';

export interface FreeItemDraft {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Venta libre: ítem sin producto registrado. Solo captura descripción,
 * cantidad y precio; el carrito lo trata como cualquier otra línea.
 */
@Component({
  selector: 'app-pos-free-item-modal',
  standalone: true,
  imports: [MoneyPipe],
  template: `
    <div
      class="fixed inset-0 bg-overlay z-40 flex items-end sm:items-center justify-center backdrop-blur-[1px]"
      (click)="closed.emit()"
    >
      <div
        class="modal-enter w-full sm:w-[440px] bg-bg-surface rounded-t-2xl sm:rounded-2xl shadow-lg z-50 px-5 pt-5 pb-7 sm:pb-5 max-h-[90vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <div class="sm:hidden w-10 h-1 rounded-full bg-bg-muted mx-auto mb-5"></div>

        <div class="flex items-center justify-between mb-1">
          <h3 class="text-base font-bold text-text-main">Venta libre</h3>
          <button
            type="button"
            class="btn-icon hover:bg-bg-muted"
            aria-label="Cerrar"
            (click)="closed.emit()"
          >
            <span class="material-icons text-[18px]">close</span>
          </button>
        </div>
        <p class="text-xs text-text-soft mb-5">Producto sin registrar en el catálogo.</p>

        <div class="space-y-4">
          <div class="flex flex-col gap-1.5">
            <label class="field-label" for="free-item-description">Descripción</label>
            <input
              id="free-item-description"
              #descriptionInput
              type="text"
              maxlength="120"
              placeholder="Ej. Pantalón diesel slim mujer 42 negro"
              [value]="description()"
              (input)="description.set($any($event.target).value)"
              [class.border-feedback-error-text]="submitted() && descriptionInvalid()"
              class="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui transition-all placeholder:text-text-soft"
            />
            <div class="flex items-center justify-between">
              @if (submitted() && descriptionInvalid()) {
                <span class="text-[10px] text-feedback-error-text">
                  La descripción es obligatoria (máx. 120 caracteres)
                </span>
              } @else {
                <span></span>
              }
              <span class="text-[10px] text-text-soft font-mono"
                >{{ description().length }}/120</span
              >
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Cantidad</label>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="adjustQuantity(-1)"
                  [disabled]="quantity() <= 1"
                  aria-label="Quitar uno"
                  class="w-9 h-9 rounded-lg border border-border bg-bg-muted text-text-main flex items-center justify-center text-base font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-elevated active:scale-95 transition-all"
                >
                  −
                </button>
                <input
                  type="number"
                  inputmode="numeric"
                  min="1"
                  [value]="quantity()"
                  (input)="onQuantityInput($event)"
                  (keydown)="blockKeys($event)"
                  aria-label="Cantidad"
                  class="field-number flex-1 min-w-0 px-2 py-2 text-center text-sm font-mono font-bold border rounded-lg bg-bg-surface text-text-main outline-none focus:border-accent-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  [class.border-feedback-error-text]="submitted() && quantityInvalid()"
                  [class.border-border]="!submitted() || !quantityInvalid()"
                />
                <button
                  type="button"
                  (click)="adjustQuantity(1)"
                  aria-label="Agregar uno"
                  class="w-9 h-9 rounded-lg border border-border bg-bg-muted text-text-main flex items-center justify-center text-base font-bold leading-none hover:bg-bg-elevated active:scale-95 transition-all"
                >
                  +
                </button>
              </div>
              @if (submitted() && quantityInvalid()) {
                <span class="text-[10px] text-feedback-error-text">Mínimo 1 unidad</span>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="field-label" for="free-item-price">Precio de venta</label>
              <input
                id="free-item-price"
                type="number"
                inputmode="decimal"
                step="0.5"
                placeholder="0.00"
                [value]="unitPrice() ?? ''"
                (input)="onPriceInput($event)"
                (keydown)="blockKeys($event)"
                class="field-number w-full px-3 py-2.5 border border-border rounded-xl text-sm font-mono font-bold text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                [class.!border-feedback-error-text]="submitted() && priceInvalid()"
              />
              @if (submitted() && priceInvalid()) {
                <span class="text-[10px] text-feedback-error-text">Mínimo Bs 0.50</span>
              }
            </div>
          </div>

          <div
            class="flex items-center justify-between rounded-xl border border-border bg-bg-muted/40 px-4 py-3"
          >
            <span class="text-[11px] font-bold uppercase tracking-wider text-text-soft"
              >Subtotal</span
            >
            <span class="text-lg font-black font-mono text-accent-ui">{{
              subtotal() | money: 'symbol'
            }}</span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 mt-6">
          <button
            type="button"
            (click)="closed.emit()"
            class="order-2 sm:order-1 flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-text-muted hover:bg-bg-muted transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="onSave()"
            class="order-1 sm:order-2 flex-1 py-2.5 bg-accent-ui text-white rounded-xl text-sm font-bold hover:bg-accent-ui/90 transition-all"
          >
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PosFreeItemModal {
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;

  saved = output<FreeItemDraft>();
  closed = output<void>();

  description = signal('');
  quantity = signal(1);
  unitPrice = signal<number | null>(null);
  submitted = signal(false);

  private readonly descriptionInput = viewChild<ElementRef<HTMLInputElement>>('descriptionInput');

  constructor() {
    // El modal nace con cada apertura (@if): enfocar acá es determinista,
    // a diferencia de `autofocus`, que no corre en contenido dinámico.
    afterNextRender(() => this.descriptionInput()?.nativeElement.focus());
  }

  private readonly trimmedDescription = computed(() => this.description().trim());

  descriptionInvalid = computed(
    () => this.trimmedDescription().length === 0 || this.trimmedDescription().length > 120,
  );
  quantityInvalid = computed(() => !Number.isInteger(this.quantity()) || this.quantity() < 1);
  priceInvalid = computed(() => this.unitPrice() == null || (this.unitPrice() ?? 0) < 0.5);

  subtotal = computed(() => (this.unitPrice() ?? 0) * this.quantity());

  onQuantityInput(event: Event): void {
    const parsed = parseInt((event.target as HTMLInputElement).value, 10);
    this.quantity.set(Number.isNaN(parsed) ? 0 : parsed);
  }

  onPriceInput(event: Event): void {
    const parsed = parseFloat((event.target as HTMLInputElement).value);
    this.unitPrice.set(Number.isFinite(parsed) ? parsed : null);
  }

  adjustQuantity(delta: number): void {
    this.quantity.set(Math.max(1, (this.quantity() || 1) + delta));
  }

  onSave(): void {
    this.submitted.set(true);
    if (this.descriptionInvalid() || this.quantityInvalid() || this.priceInvalid()) return;

    this.saved.emit({
      description: this.trimmedDescription(),
      quantity: this.quantity(),
      unitPrice: this.unitPrice()!,
    });
  }
}
