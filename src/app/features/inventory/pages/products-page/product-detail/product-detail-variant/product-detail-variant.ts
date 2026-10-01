import { Component, inject, input, output } from '@angular/core';
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
      class="hidden sm:grid gap-2 items-center
               px-3 py-3 hover:bg-bg-muted/60 transition-colors text-sm"
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

    <!-- ── Mobile Card ──────────────────────────────────────────────────────── -->
    <li class="flex sm:hidden flex-col gap-2 py-3">
      <div class="flex-1 min-w-0">
        <p class="font-mono text-xs text-text-soft truncate mb-0.5">
          @for (p of parts(variant().sku); track $index) {
            @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
          }
        </p>
        <p class="text-sm font-medium text-text-main">
          @for (p of parts(variant().size); track $index) {
            @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
          }
          ·
          @for (p of parts(variant().color); track $index) {
            @if (p.hit) { <mark class="bg-accent-ui/30 text-inherit rounded-[2px]">{{ p.part }}</mark> } @else { {{ p.part }} }
          }
        </p>
        <p class="text-xs text-text-muted mt-0.5">
          {{ variant().price | number: '1.2-2' }}
          @if (perm.canUpdate('inventory', 'products')) {
            · costo {{ variant().averageCost | number: '1.2-2' }}
            · margen {{ ((variant().price - (variant().averageCost ?? 0))) | number: '1.2-2' }}
          }
          ·
          <span class="font-medium text-feedback-success-text">{{ variant().totalAvailable }} u</span>
        </p>
        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted mt-1">
          @for (branchId of branchKeys(); track branchId) {
            <span [class.text-accent-ui]="branchId === activeBranchId()" [class.font-semibold]="branchId === activeBranchId()">{{ branchMap()[branchId] }}: {{ getStock(branchId) }}u</span>
          }
        </div>
      </div>
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

  editVariant = output<ProductVariantDto>();
  deleteVariant = output<ProductVariantDto>();
  adjustStock = output<ProductVariantDto>();
  viewHistory = output<ProductVariantDto>();

  getStock(branchId: string): number {
    return this.variant().branchStocks.find((s) => s.branchId === branchId)?.stock ?? 0;
  }

  parts(text: string) {
    return highlightParts(text, this.highlightTokens());
  }
}
