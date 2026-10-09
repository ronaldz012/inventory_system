import { Component, computed, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ProductVariantDto } from '../../../../dtos/products/product-detail-dto';
import { PermissionService } from '@features/auth/services/permmision-service';
import { highlightParts } from '../variant-filter';

@Component({
  selector: 'app-product-detail-variant',
  imports: [DecimalPipe],
  template: `
    <!-- ── Desktop Row: Sku | Color | Talla | Sucs | Total | Precio | [Costo | Margen] | Acciones ── -->
    <li
      class="hidden sm:grid gap-2 items-center border-t border-border
               px-3 py-3 hover:bg-bg-muted/60 transition-colors text-sm"
      [class.!border-t-2]="firstOfColor()"
      [class.!border-border-strong]="firstOfColor()"
      [style.grid-template-columns]="gridColumnsStyle()"
    >
      <span class="font-mono text-xs text-text-muted truncate">
        @for (p of parts(variant().sku); track $index) {
          @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
        }
      </span>
      <span class="field-value truncate">
        @for (p of parts(variant().color); track $index) {
          @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
        }
      </span>
      <span class="field-value">
        @for (p of parts(variant().size); track $index) {
          @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
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
      <span class="tabular-nums font-semibold text-right">{{ variant().price | number: '1.2-2' }}</span>
      @if (perm.canUpdate('inventory', 'products')) {
        <span class="field-value text-right">{{ variant().averageCost | number: '1.2-2' }}</span>
        <span class="field-value font-mono text-right" [class.text-feedback-success-text]="(variant().price - (variant().averageCost ?? 0)) > 0" [class.text-text-soft]="(variant().price - (variant().averageCost ?? 0)) <= 0">{{ ((variant().price - (variant().averageCost ?? 0))) | number: '1.2-2' }}</span>
      }
      <div class="flex gap-1 justify-end">
        <button (click)="viewHistory.emit(variant())" class="action-btn" title="Ver movimientos">
          <span class="material-icons text-base">history</span>
        </button>
        @if (perm.canUpdate('inventory', 'products')) {
          <button (click)="adjustStock.emit(variant())" class="action-btn action-btn--edit" title="Ajustar stock">
            <span class="material-icons text-base">inventory</span>
          </button>
          <button (click)="editVariant.emit(variant())" class="action-btn action-btn--edit" title="Editar talla/color">
            <span class="material-icons text-base">edit</span>
          </button>
        }
        @if (perm.canDelete('inventory', 'products')) {
          <button (click)="deleteVariant.emit(variant())" class="action-btn action-btn--delete" title="Eliminar talla/color">
            <span class="material-icons text-base">delete</span>
          </button>
        }
      </div>
    </li>

    <!-- ── Mobile Card compacta: color/talla + SKU + stock activa + precio ─── -->
    <li
      class="flex sm:hidden flex-col border-t border-border"
      [class.!border-t-2]="firstOfColor()"
      [class.!border-border-strong]="firstOfColor()"
    >
      <button
        type="button"
        (click)="toggleExpand.emit()"
        [attr.aria-expanded]="expanded()"
        class="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span class="flex-1 min-w-0">
          <span class="block text-[13px] font-semibold text-text-main truncate">
            @for (p of parts(variant().color); track $index) {
              @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
            }
            ·
            @for (p of parts(variant().size); track $index) {
              @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
            }
          </span>
          <span class="block font-mono text-xs font-bold text-accent-ui truncate">
            @for (p of parts(variant().sku); track $index) {
              @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
            }
          </span>
        </span>
        <span
          class="shrink-0 text-[13px] font-mono font-bold"
          [class.text-accent-ui]="activeStock() > 0"
          [class.text-text-soft]="activeStock() <= 0"
        >{{ activeStock() }}u</span>
        <span class="shrink-0 text-xs font-mono text-text-muted">{{ variant().price | number: '1.2-2' }}</span>
        <span
          class="material-icons text-base text-text-soft shrink-0 transition-transform duration-200"
          [class.rotate-180]="expanded()"
        >expand_more</span>
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
                >{{ branchMap()[branchId] }}</span>
                <span class="flex-1 border-b border-dotted border-border"></span>
                <span class="font-mono font-semibold text-text-main">{{ getStock(branchId) }}u</span>
              </div>
            }
            <div class="flex items-baseline gap-2 text-xs">
              <span class="font-semibold text-text-main">Total</span>
              <span class="flex-1 border-b border-dotted border-border"></span>
              <span class="font-mono font-bold text-text-main">{{ variant().totalAvailable }}u</span>
            </div>
          </div>
          @if (perm.canUpdate('inventory', 'products')) {
            <p class="text-xs text-text-muted">
              Costo <span class="font-mono font-semibold text-text-main">{{ variant().averageCost | number: '1.2-2' }}</span>
              · Margen <span class="font-mono font-semibold text-text-main">{{ ((variant().price - (variant().averageCost ?? 0))) | number: '1.2-2' }}</span>
            </p>
          }
          <div class="flex items-center gap-3">
            <button (click)="viewHistory.emit(variant())" class="btn-link"><span class="btn-link-text">Ver movimientos</span><span class="material-icons text-base">chevron_right</span></button>
            @if (perm.canUpdate('inventory', 'products')) {
              <button (click)="adjustStock.emit(variant())" class="action-text action-text--edit">Ajustar</button>
              <button (click)="editVariant.emit(variant())" class="action-text action-text--edit">Editar</button>
            }
            @if (perm.canDelete('inventory', 'products')) {
              <button (click)="deleteVariant.emit(variant())" class="action-text action-text--delete">Eliminar</button>
            }
          </div>
        </div>
      }
    </li>
  `,
})
export class ProductDetailVariant {
  readonly perm = inject(PermissionService);
  variant = input.required<ProductVariantDto>();
  submitting = input.required<boolean>();
  branchMap = input<Record<string, string>>({});
  branchKeys = input<string[]>([]);
  activeBranchId = input<string | null>(null);
  gridColumnsStyle = input<string>('');
  highlightTokens = input<string[]>([]);
  expanded = input(false);
  /** Corte entre colores: raya fuerte arriba cuando abre un color nuevo. */
  firstOfColor = input(false);

  editVariant = output<ProductVariantDto>();
  deleteVariant = output<ProductVariantDto>();
  adjustStock = output<ProductVariantDto>();
  viewHistory = output<ProductVariantDto>();
  toggleExpand = output<void>();

  activeStock = computed(() => this.getStock(this.activeBranchId() ?? ''));

  getStock(branchId: string): number {
    return this.variant().branchStocks.find((s) => s.branchId === branchId)?.stock ?? 0;
  }

  parts(text: string) {
    return highlightParts(text, this.highlightTokens());
  }
}
