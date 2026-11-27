import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { ProductVariantDto } from '../../../../dtos/products/product-detail-dto';
import { PermissionService } from '@features/auth/services/permmision-service';
import { highlightParts } from '../variant-filter';
import { ViewportService } from '@core/services/viewport-service';

/**
 * Acciones de una fila de variante: un único contrato tipado para las dos
 * vistas (fila desktop / card mobile). El padre resuelve con un switch
 * exhaustivo — agregar una acción no agranda la superficie del componente.
 */
export type VariantAction =
  | { type: 'viewHistory'; variant: ProductVariantDto }
  | { type: 'edit'; variant: ProductVariantDto }
  | { type: 'delete'; variant: ProductVariantDto }
  | { type: 'adjustStock'; variant: ProductVariantDto }
  | { type: 'toggleSelect'; variant: ProductVariantDto }
  | { type: 'toggleExpand'; variant: ProductVariantDto };

/**
 * Fila de variante del detalle de producto.
 *
 * Monta UNA sola variante según viewport (antes: ambas en el DOM, una oculta
 * por CSS). El estado vive en el padre (expandida/seleccionada), esta fila
 * es presentacional: al rotar el dispositivo se recrea sin perder nada.
 */
@Component({
  selector: 'app-product-detail-variant',
  imports: [MoneyPipe],
  template: `
    @if (viewport.isDesktop()) {
      <!-- ── Fila desktop: ☐ | Sku | Color | Talla | Sucs | Total | Precio | [Costo|Margen] | ⋯ ── -->
      <li
        class="grid gap-2 items-center border-t border-border px-3 py-3 hover:bg-bg-muted/60 transition-colors text-sm"
        [class.!border-t-2]="firstOfColor()"
        [class.!border-border-strong]="firstOfColor()"
        [style.grid-template-columns]="gridColumnsStyle()"
      >
        @if (selectable()) {
          <input
            type="checkbox"
            class="w-4 h-4 accent-accent-ui cursor-pointer justify-self-center"
            [checked]="selected()"
            (change)="emitAction('toggleSelect')"
            [attr.aria-label]="'Seleccionar ' + variant().sku"
          />
        }
        <span class="font-mono text-xs text-text-muted truncate">
          @for (p of parts(variant().sku); track $index) {
            @if (p.hit) {
              <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark>
            } @else {
              {{ p.part }}
            }
          }
        </span>
        <span class="field-value truncate">
          @for (p of parts(variant().color); track $index) {
            @if (p.hit) {
              <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark>
            } @else {
              {{ p.part }}
            }
          }
        </span>
        <span class="field-value">
          @for (p of parts(variant().size); track $index) {
            @if (p.hit) {
              <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark>
            } @else {
              {{ p.part }}
            }
          }
        </span>
        @for (branchId of branchKeys(); track branchId) {
          <span
            class="tabular-nums text-center"
            [class.text-accent-ui]="branchId === activeBranchId()"
            [class.font-bold]="branchId === activeBranchId()"
            >{{ getStock(branchId) }}</span
          >
        }
        <span class="tabular-nums font-semibold text-center">{{ variant().totalAvailable }}</span>
        <span class="tabular-nums font-semibold text-right">{{ variant().price | money }}</span>
        @if (perm.canUpdate('inventory', 'products')) {
          <span class="field-value text-right">{{ variant().averageCost | money }}</span>
          <span
            class="field-value font-mono text-right"
            [class.text-feedback-success-text]="variant().price - (variant().averageCost ?? 0) > 0"
            [class.text-text-soft]="variant().price - (variant().averageCost ?? 0) <= 0"
            >{{ variant().price - (variant().averageCost ?? 0) | money }}</span
          >
        }
        <div class="relative flex justify-end">
          <button
            type="button"
            (click)="toggleMenu()"
            class="action-btn"
            [attr.aria-expanded]="menuOpen()"
            aria-haspopup="menu"
            [attr.aria-label]="'Acciones de ' + variant().sku"
          >
            <span class="material-icons text-base">more_horiz</span>
          </button>
          @if (menuOpen()) {
            <div class="fixed inset-0 z-40" (click)="closeMenu()" aria-hidden="true"></div>
            <div
              role="menu"
              class="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-bg-surface p-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                (click)="emitAction('viewHistory')"
                class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-main transition-colors hover:bg-bg-muted"
              >
                <span class="material-icons text-base">history</span>
                Ver movimientos
              </button>
              @if (perm.canUpdate('inventory', 'products')) {
                <button
                  type="button"
                  role="menuitem"
                  (click)="emitAction('adjustStock')"
                  class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-main transition-colors hover:bg-bg-muted"
                >
                  <span class="material-icons text-base">inventory</span>
                  Ajustar stock
                </button>
                <button
                  type="button"
                  role="menuitem"
                  (click)="emitAction('edit')"
                  class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-main transition-colors hover:bg-bg-muted"
                >
                  <span class="material-icons text-base">edit</span>
                  Editar talla/color
                </button>
              }
              @if (perm.canDelete('inventory', 'products')) {
                <button
                  type="button"
                  role="menuitem"
                  (click)="emitAction('delete')"
                  class="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-feedback-error-text transition-colors hover:bg-bg-muted"
                >
                  <span class="material-icons text-base">delete</span>
                  Eliminar talla/color
                </button>
              }
            </div>
          }
        </div>
      </li>
    } @else {
      <!-- ── Card mobile: ☐ con tap propio, el cuerpo expande ── -->
      <li
        class="flex border-t border-border"
        [class.!border-t-2]="firstOfColor()"
        [class.!border-border-strong]="firstOfColor()"
      >
        @if (selectable()) {
          <label
            class="flex items-center justify-center w-9 shrink-0 cursor-pointer self-start pt-3"
          >
            <input
              type="checkbox"
              class="w-4 h-4 accent-accent-ui cursor-pointer"
              [checked]="selected()"
              (change)="emitAction('toggleSelect')"
              [attr.aria-label]="'Seleccionar ' + variant().sku"
            />
          </label>
        }
        <div class="flex-1 min-w-0 flex flex-col">
          <button
            type="button"
            (click)="emitAction('toggleExpand')"
            [attr.aria-expanded]="expanded()"
            class="w-full flex items-center gap-2 px-3 py-2 text-left"
          >
            <span class="flex-1 min-w-0">
              <span class="block text-[13px] font-semibold text-text-main truncate">
                @for (p of parts(variant().color); track $index) {
                  @if (p.hit) {
                    <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark>
                  } @else {
                    {{ p.part }}
                  }
                }
                ·
                @for (p of parts(variant().size); track $index) {
                  @if (p.hit) {
                    <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark>
                  } @else {
                    {{ p.part }}
                  }
                }
              </span>
              <span class="block font-mono text-xs font-bold text-accent-ui truncate">
                @for (p of parts(variant().sku); track $index) {
                  @if (p.hit) {
                    <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark>
                  } @else {
                    {{ p.part }}
                  }
                }
              </span>
            </span>
            <span
              class="shrink-0 text-[13px] font-mono font-bold"
              [class.text-accent-ui]="activeStock() > 0"
              [class.text-text-soft]="activeStock() <= 0"
              >{{ activeStock() }}u</span
            >
            <span class="shrink-0 text-xs font-mono text-text-muted">{{
              variant().price | money
            }}</span>
            <span
              class="material-icons text-base text-text-soft shrink-0 transition-transform duration-200"
              [class.rotate-180]="expanded()"
              >expand_more</span
            >
          </button>
          @if (expanded()) {
            <div class="px-3 pb-2.5 pt-1.5 border-t border-border/40 flex flex-col gap-2">
              <div class="flex flex-col gap-1">
                @for (branchId of branchKeys(); track branchId) {
                  <div class="flex items-baseline gap-2 text-xs">
                    <span
                      class="truncate"
                      [class.text-accent-ui]="branchId === activeBranchId()"
                      [class.font-semibold]="branchId === activeBranchId()"
                      [class.text-text-muted]="branchId !== activeBranchId()"
                      >{{ branchMap()[branchId] }}</span
                    >
                    <span class="flex-1 border-b border-dotted border-border"></span>
                    <span class="font-mono font-semibold text-text-main"
                      >{{ getStock(branchId) }}u</span
                    >
                  </div>
                }
                <div class="flex items-baseline gap-2 text-xs">
                  <span class="font-semibold text-text-main">Total</span>
                  <span class="flex-1 border-b border-dotted border-border"></span>
                  <span class="font-mono font-bold text-text-main"
                    >{{ variant().totalAvailable }}u</span
                  >
                </div>
              </div>
              @if (perm.canUpdate('inventory', 'products')) {
                <p class="text-xs text-text-muted">
                  Costo
                  <span class="font-mono font-semibold text-text-main">{{
                    variant().averageCost | money
                  }}</span>
                  · Margen
                  <span class="font-mono font-semibold text-text-main">{{
                    variant().price - (variant().averageCost ?? 0) | money
                  }}</span>
                </p>
              }
              <div class="flex items-center gap-3">
                <button (click)="emitAction('viewHistory')" class="btn-link">
                  <span class="btn-link-text">Ver movimientos</span
                  ><span class="material-icons text-base">chevron_right</span>
                </button>
                @if (perm.canUpdate('inventory', 'products')) {
                  <button (click)="emitAction('adjustStock')" class="action-text action-text--edit">
                    Ajustar
                  </button>
                  <button (click)="emitAction('edit')" class="action-text action-text--edit">
                    Editar
                  </button>
                }
                @if (perm.canDelete('inventory', 'products')) {
                  <button (click)="emitAction('delete')" class="action-text action-text--delete">
                    Eliminar
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </li>
    }
  `,
})
export class ProductDetailVariant {
  readonly perm = inject(PermissionService);
  readonly viewport = inject(ViewportService);

  variant = input.required<ProductVariantDto>();
  branchMap = input<Record<string, string>>({});
  branchKeys = input<string[]>([]);
  activeBranchId = input<string | null>(null);
  gridColumnsStyle = input<string>('');
  highlightTokens = input<string[]>([]);
  /** Seleccionable para acciones bulk (checkbox visible). */
  selectable = input(false);
  selected = input(false);
  /** Corte entre colores: raya fuerte arriba cuando abre un color nuevo. */
  firstOfColor = input(false);
  /** Solo mobile: card expandida (una a la vez, estado en el padre). */
  expanded = input(false);

  action = output<VariantAction>();

  /** Menú ⋯ de la fila desktop. */
  menuOpen = signal(false);

  activeStock = computed(() => this.getStock(this.activeBranchId() ?? ''));

  getStock(branchId: string): number {
    return this.variant().branchStocks.find((s) => s.branchId === branchId)?.stock ?? 0;
  }

  parts(text: string) {
    return highlightParts(text, this.highlightTokens());
  }

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Las acciones del menú lo cierran antes de emitir. */
  emitAction(
    type: 'viewHistory' | 'edit' | 'delete' | 'adjustStock' | 'toggleSelect' | 'toggleExpand',
  ): void {
    this.menuOpen.set(false);
    this.action.emit({ type, variant: this.variant() });
  }
}
