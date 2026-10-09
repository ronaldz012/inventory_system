import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProductService } from '../../../services/product-service';
import { ProductDetailDto, ProductVariantDto } from '../../../dtos/products/product-detail-dto';
import { GENDER_LABELS, Gender } from '../../../interfaces/gender';
import { BranchContextService } from '@core/services/branch-context-service';

import { UpdateProductVariantStockDto } from '../../../dtos/products/update-product-variant-stock-dto';
import { ProductDetailVariant } from './product-detail-variant/product-detail-variant';
import { UpdateVariantModal } from './product-detail-variant/update-variant-modal';
import { AdjustStockModal } from './product-detail-variant/adjust-stock-modal';
import AddVariantModal from './product-detail-variant/add-variant-modal';
import { ConfirmActionModal } from '../../transfer-page/confirm-action-modal/confirm-action-modal';
import { UpdateProductModal } from './update-product-modal';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { UpdateProductDto } from '../../../dtos/products/update-product-dto';
import { UpdateProductVariantDto } from '../../../dtos/products/update-product-variant-dto';
import { BulkUpdateVariantPriceItem } from '../../../dtos/products/bulk-update-variant-price-dto';
import { BulkPriceModal } from './product-detail-variant/bulk-price-modal';
import { ProductEditPanel } from './product-edit-panel/product-edit-panel';
import { CreateProductVariantDto } from '../../../dtos/products/create-product-variant-dto';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { closeModal, getModalId, openModal } from '@shared/utils/modal-query';
import {
  matchesVariant,
  sortBranchIds,
  sortVariantsByStock,
  tokenize,
  VariantSort,
} from './variant-filter';

@Component({
  selector: 'app-product-detail',
  imports: [
    ProductDetailVariant,
    UpdateProductModal,
    UpdateVariantModal,
    AdjustStockModal,
    AddVariantModal,
    BulkPriceModal,
    ProductEditPanel,
    ConfirmActionModal,
    SkeletonList,
  ],
  template: `
    <div class="max-w-6xl mx-auto fade-up">
      @if (loading()) {
        <app-skeleton-list [rows]="3" [columns]="2" />
      } @else if (product(); as p) {
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <button type="button" (click)="goBack()" class="btn-icon">
              <span class="material-icons text-base">arrow_back</span>
            </button>
            <h1 class="text-lg font-black text-text-main">Detalle del Producto</h1>
          </div>

          <!-- ── Información del Producto ─────────────────────────────────────── -->
          <div class="bg-bg-surface rounded-xl border border-border-strong px-4 py-3">
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-text-main break-words leading-snug">{{ p.name }}</p>
              <span
                class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold shrink-0"
                [class]="
                  p.isActive
                    ? 'bg-feedback-success text-feedback-success-text'
                    : 'bg-feedback-warning text-feedback-warning-text'
                "
              >
                {{ p.isActive ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
            <p class="text-[13px] font-mono font-semibold text-accent-ui mt-0.5">{{ p.internalCode }}</p>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <p class="table-header">Stock total</p>
                <p class="text-xl font-black font-mono text-accent-ui">{{ p.totalAvailable }} <span class="text-xs font-bold">u</span></p>
              </div>
              <div class="min-w-0">
                <p class="table-header">Marca</p>
                <p class="text-sm font-bold text-text-main truncate" [title]="p.brandName">{{ p.brandName || '—' }}</p>
              </div>
              <div class="min-w-0">
                <p class="table-header">Categoría</p>
                <p class="text-sm font-bold text-text-main truncate" [title]="p.categoryName">{{ p.categoryName || '—' }}</p>
              </div>
              <div class="min-w-0">
                <p class="table-header">Género</p>
                <p class="text-sm font-bold text-text-main truncate">{{ genderLabel(p.gender) }}</p>
              </div>
            </div>
            @if (p.description) {
              <p class="text-[13px] text-text-muted leading-snug mt-1">{{ p.description }}</p>
            }
            <div class="flex flex-wrap items-center gap-2 border-t border-border mt-3 pt-3">
              @if (perm.canUpdate('inventory', 'products')) {
                <button (click)="openFullEdit()" class="btn-primary btn-sm" title="Editar">
                  <span class="material-icons text-base leading-none">edit</span>
                  <span>Editar</span>
                </button>
                <button
                  (click)="openToggleStatus()"
                  class="btn-secondary btn-sm"
                  [title]="p.isActive ? 'Desactivar producto' : 'Activar producto'"
                >
                  <span class="material-icons text-base leading-none">toggle_on</span>
                  <span>{{ p.isActive ? 'Desactivar' : 'Activar' }}</span>
                </button>
              }
              @if (perm.canDelete('inventory', 'products')) {
                <button (click)="openDeleteProduct()" class="btn-danger btn-sm" title="Eliminar">
                  <span class="material-icons text-base leading-none">delete</span>
                  <span>Eliminar</span>
                </button>
              }
            </div>
          </div>

          <!-- ── Variantes ────────────────────────────────────────────────────── -->
          <div class="bg-bg-surface rounded-xl border border-border-strong shadow-sm p-5">
            <div class="flex items-center justify-between mb-3">
              <p class="section-title mb-0">
                Tallas/Colores · {{ p.variants.length }}
              </p>
              @if (perm.canUpdate('inventory', 'products')) {
                <button (click)="openAddVariant()" class="btn-secondary btn-sm">
                  <span class="material-icons text-base leading-none">add</span>
                  Agregar
                </button>
              }
            </div>

            <div
              #variantSearch
              class="scroll-mt-16 flex items-center gap-2 mb-3"
              (focusin)="onVariantSearchFocus()"
            >
              <div class="relative flex-1">
                <input
                  [value]="variantQuery()"
                  (input)="variantQuery.set($any($event.target).value)"
                  (keydown.enter)="onVariantSearchEnter($event)"
                  placeholder="Buscar talla, color o SKU… (ej. azul 44)"
                  aria-label="Buscar variantes por talla, color o SKU"
                  enterkeyhint="search"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  class="w-full py-2 text-sm text-text-main bg-bg-surface border border-border rounded-lg placeholder:text-text-soft focus:outline-none focus:border-accent-ui focus:ring-1 focus:ring-accent-ui"
                  [class.pr-8]="variantQuery()"
                  [class.pl-3]="!variantQuery()"
                  [class.pl-2]="variantQuery()"
                />
                @if (variantQuery()) {
                  <button
                    type="button"
                    (click)="variantQuery.set('')"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-text-soft hover:text-text-main"
                    aria-label="Limpiar búsqueda"
                  >
                    <span class="material-icons text-base">close</span>
                  </button>
                }
              </div>
              @if (variantQuery().trim()) {
                <span class="text-xs text-text-soft whitespace-nowrap">{{ filteredVariants().length }} de {{ p.variants.length }}</span>
              }
              <div class="relative shrink-0" data-sort-menu>
                <button
                  #sortTrigger
                  type="button"
                  (click)="toggleSortMenu()"
                  class="btn btn-sm gap-1 relative disabled:opacity-40 disabled:cursor-not-allowed"
                  [class.btn-secondary]="sortMode() === 'off'"
                  [class.border-accent-ui]="sortMode() !== 'off'"
                  [class.bg-accent-ui]="sortMode() !== 'off'"
                  [class.text-accent-ui]="sortMode() !== 'off'"
                  [disabled]="!activeBranchId()"
                  aria-haspopup="menu"
                  [attr.aria-expanded]="sortMenuOpen()"
                  [title]="sortLabel()"
                  [attr.aria-label]="sortLabel()"
                >
                  <span class="material-icons text-base leading-none">{{ sortIcon() }}</span>
                  @if (sortMode() !== 'off') {
                    <span class="whitespace-nowrap">{{ sortText() }}</span>
                  } @else {
                    <span class="hidden sm:inline whitespace-nowrap">Ordenar</span>
                  }
                  @if (sortMode() !== 'off') {
                    <span
                      class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent-ui"
                      aria-hidden="true"
                    ></span>
                  }
                </button>

                @if (sortMenuOpen()) {
                  <div
                    role="menu"
                    aria-label="Ordenar variantes"
                    (keydown)="onSortMenuKeydown($event)"
                    class="absolute top-[calc(100%+6px)] right-0 z-50 w-max min-w-[13rem] max-w-[calc(100vw-2rem)] rounded-[10px] border border-border bg-bg-surface p-1 shadow-lg"
                  >
                    @for (opt of sortOptions; track opt.mode) {
                      <button
                        #sortOption
                        type="button"
                        role="menuitemradio"
                        [attr.aria-checked]="sortMode() === opt.mode"
                        (click)="selectSort(opt.mode)"
                        class="w-full flex items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-sm transition-colors hover:bg-bg-muted"
                        [class.text-accent-ui]="sortMode() === opt.mode"
                        [class.font-semibold]="sortMode() === opt.mode"
                        [class.text-text-main]="sortMode() !== opt.mode"
                      >
                        <span class="material-icons text-sm w-4 shrink-0 text-center leading-none">
                          @if (sortMode() === opt.mode) {
                            check
                          }
                        </span>
                        <span class="whitespace-nowrap">{{ opt.label }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
            @if (activeBranchId(); as activeId) {
              <p class="text-[11px] text-text-soft -mt-2 mb-1">Stock en: <span class="font-semibold text-accent-ui">{{ branchMap()[activeId] }}</span></p>
            }

            <!-- ── Desktop ─────────────────────────────────────────────────────── -->
            <div class="hidden sm:block">
              <div
                class="grid gap-2 px-3 py-2 bg-bg-muted rounded-lg mb-1"
                [style.grid-template-columns]="gridColumnsStyle()"
              >
                <span class="table-header">SKU</span>
                <span class="table-header">COLOR</span>
                <span class="table-header">TALLA</span>
                @for (branchId of branchKeys(); track branchId) {
                  <span
                    class="text-[11px] font-semibold normal-case leading-tight line-clamp-2 text-center text-text-muted"
                    [class.text-accent-ui]="branchId === activeBranchId()"
                    [class.font-bold]="branchId === activeBranchId()"
                    [title]="branchMap()[branchId]"
                  >
                    {{ branchMap()[branchId] }}
                    @if (branchId === activeBranchId()) {
                      <span class="ml-1 text-accent-ui">●</span>
                    }
                  </span>
                }
                <span class="table-header">TOTAL VISIBLE</span>
                <span class="table-header text-right">PRECIO</span>
                @if (perm.canUpdate('inventory', 'products')) {
                  <span class="table-header text-right">COSTO</span>
                  <span class="table-header text-right">MARGEN</span>
                }
                <span></span>
              </div>

              <ul class="flex flex-col">
                @for (v of sortedVariants(); track v.id; let i = $index) {
                  <app-product-detail-variant
                    [variant]="v"
                    [firstOfColor]="isFirstOfColor(i)"
                    [submitting]="submitting()"
                    [branchMap]="branchMap()"
                    [branchKeys]="branchKeys()"
                    [activeBranchId]="activeBranchId()"
                    [gridColumnsStyle]="gridColumnsStyle()"
                    [highlightTokens]="searchTokens()"
                    (editVariant)="onEditVariant($event)"
                    (deleteVariant)="onDeleteVariant($event)"
                    (adjustStock)="onAdjustStock($event)"
                    (viewHistory)="onViewHistory($event)"
                  />
                }
              </ul>
            </div>

            <!-- Sin resultados: debajo del cabezal en desktop (arriba en mobile,
                 porque las dos listas anteriores quedan vacías) -->
            @if (variantQuery().trim() && filteredVariants().length === 0) {
              <div class="flex flex-col items-center gap-2 py-10 text-text-soft">
                <span class="material-icons text-3xl">search_off</span>
                <p class="text-sm font-medium text-text-main">Sin coincidencias</p>
                <button
                  type="button"
                  (click)="variantQuery.set('')"
                  class="text-xs font-bold text-accent-ui hover:underline"
                >
                  Limpiar búsqueda
                </button>
              </div>
            }

            <!-- ── Mobile ──────────────────────────────────────────────────────── -->
            @if (filteredVariants().length > 0) {
              <div class="sm:hidden flex items-center gap-2 px-3 pr-8 pb-1.5" aria-hidden="true">
                <span class="flex-1 table-header">Talla · Color</span>
                <span class="table-header">Stock</span>
                <span class="table-header">Precio</span>
              </div>
            }
            <ul class="flex flex-col sm:hidden">
              @for (v of sortedVariants(); track v.id; let i = $index) {
                <app-product-detail-variant
                  [variant]="v"
                  [firstOfColor]="isFirstOfColor(i)"
                  [submitting]="submitting()"
                  [branchMap]="branchMap()"
                  [branchKeys]="branchKeys()"
                  [activeBranchId]="activeBranchId()"
                  [gridColumnsStyle]="gridColumnsStyle()"
                  [highlightTokens]="searchTokens()"
                  [expanded]="expandedVariantId() === v.id"
                  (toggleExpand)="toggleExpand(v.id)"
                  (editVariant)="onEditVariant($event)"
                  (deleteVariant)="onDeleteVariant($event)"
                  (adjustStock)="onAdjustStock($event)"
                  (viewHistory)="onViewHistory($event)"
                />
              }
            </ul>
          </div>
        </div>
      }
    </div>

    <!-- ── Modales ─────────────────────────────────────────────────────────── -->

    <!-- Editar producto -->
    @if (showUpdateProduct() && product()) {
      <app-update-product-modal
        [product]="product()!"
        [submitting]="submitting()"
        (save)="onFullSave($event)"
        (close)="closeModal()"
      />
    }

    <!-- Eliminar producto -->
    @if (showDeleteProduct()) {
      <app-confirm-action-modal
        title="¿Eliminar producto?"
        description="Esta acción eliminará el producto y todas sus tallas/colores. No se puede deshacer."
        confirmLabel="Sí, eliminar"
        submittingLabel="Eliminando..."
        confirmButtonClass="bg-red-500 hover:bg-red-600"
        [submitting]="submitting()"
        (confirm)="onDeleteProduct()"
        (close)="closeModal()"
      />
    }

    <!-- Cambiar estado (activo/inactivo) -->
    @if (showToggleStatus() && product()) {
      <app-confirm-action-modal
        [title]="product()!.isActive ? '¿Desactivar producto?' : '¿Activar producto?'"
        [description]="
          product()!.isActive
            ? 'El producto dejará de aparecer en búsquedas, recepciones, traspasos y ventas.'
            : 'El producto volverá a estar disponible para búsquedas, recepciones, traspasos y ventas.'
        "
        [confirmLabel]="product()!.isActive ? 'Sí, desactivar' : 'Sí, activar'"
        submittingLabel="Guardando..."
        [submitting]="submitting()"
        (confirm)="onToggleStatus()"
        (close)="closeModal()"
      />
    }

    <!-- Editar variante -->
    @if (editingVariant()) {
      <app-update-variant-modal
        [variant]="editingVariant()!"
        [submitting]="submitting()"
        (save)="onUpdateVariant($event)"
        (close)="closeModal()"
      />
    }

    <!-- Edición masiva de precios -->
    @if (showBulkPrices() && product()) {
      <app-bulk-price-modal
        [variants]="product()!.variants"
        [submitting]="submitting()"
        (save)="onBulkPricesSave($event)"
        (close)="closeModal()"
      />
    }

    <!-- Edición completa (datos + precios) -->
    @if (showFullEdit() && product()) {
      <app-product-edit-panel
        [product]="product()!"
        [submitting]="submitting()"
        (save)="onFullSave($event)"
        (close)="closeModal()"
      />
    }

    <!-- Eliminar variante -->
    @if (deletingVariant()) {
      <app-confirm-action-modal
        title="¿Eliminar talla/color?"
        [description]="
          'Se eliminará la talla/color ' + deletingVariant()!.sku + '. No se puede deshacer.'
        "
        confirmLabel="Sí, eliminar"
        submittingLabel="Eliminando..."
        confirmButtonClass="bg-red-500 hover:bg-red-600"
        [submitting]="submitting()"
        (confirm)="onConfirmDeleteVariant()"
        (close)="closeModal()"
      />
    }

    <!-- Ajustar stock -->
    @if (adjustingStockVariant()) {
      <app-adjust-stock-modal
        [variant]="adjustingStockVariant()!"
        [currentStock]="activeBranchStock()"
        [currentBranchName]="activeBranchName()"
        [submitting]="submitting()"
        (save)="onSaveStockAdjust($event)"
        (close)="closeModal()"
      />
    }

    <!-- Agregar talla/color -->
    @if (showAddVariant() && product()) {
      <app-add-variant-modal
        [existingVariants]="product()!.variants"
        [submitting]="submitting()"
        (save)="onAddVariantSave($event)"
        (close)="closeModal()"
      />
    }
  `,
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
})
export default class ProductDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private branchContext = inject(BranchContextService);
  private toastService = inject(ToastService);
  readonly perm = inject(PermissionService);

  // ── Sucursales (derivadas del producto, siempre en alfabético) ──────────
  branchKeys = computed<string[]>(() => {
    const p = this.product();
    if (!p) return [];
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const v of p.variants) {
      for (const s of v.branchStocks) {
        if (!seen.has(s.branchId)) {
          seen.add(s.branchId);
          keys.push(s.branchId);
        }
      }
    }
    return sortBranchIds(keys, this.branchMap());
  });

  branchMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const p = this.product();
    if (p) {
      for (const v of p.variants) {
        for (const s of v.branchStocks) {
          map[s.branchId] = s.branchName;
        }
      }
    }
    return map;
  });

  // Orden: Sku, Color, Talla, Sucursales, Total, Precio, [Costo, Margen], Acciones
  gridColumnsStyle = computed(() => {
    const showCost = this.perm.canUpdate('inventory', 'products');
    const cols = ['7.5rem', '84px', '56px'];
    cols.push(...this.branchKeys().map(() => '104px'));
    cols.push('72px', '72px');
    if (showCost) cols.push('64px', '64px');
    cols.push('128px');
    return cols.join(' ');
  });

  /** Sucursal activa para resaltar su inventario */
  activeBranchId = computed(() => this.branchContext.getActiveBranchId());

  // ── Data ────────────────────────────────────────────────────────────────
  product = signal<ProductDetailDto | null>(null);
  loading = signal(true);
  submitting = signal(false);

  // ── Card mobile expandida (una a la vez, vive en el padre) ─────────────
  expandedVariantId = signal<GUID | null>(null);

  toggleExpand(id: GUID): void {
    this.expandedVariantId.update((cur) => (cur === id ? null : id));
  }

  // ── Búsqueda de variantes (talla/color/SKU, multi-token sin orden) ───────
  variantQuery = signal('');
  private variantSearchRow = viewChild<ElementRef<HTMLDivElement>>('variantSearch');

  /**
   * En mobile el teclado virtual tapa la lista: al enfocar subimos el buscador
   * (scroll-mt-16 compensa el topbar sticky) para que los resultados queden
   * a la vista. Se espera para que el teclado termine de abrir.
   */
  onVariantSearchFocus(): void {
    setTimeout(() => {
      const row = this.variantSearchRow();
      row?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  /** Enter = "listo": baja el teclado y deja la lista visible. */
  onVariantSearchEnter(event: Event): void {
    (event.target as HTMLInputElement).blur();
  }
  searchTokens = computed(() => tokenize(this.variantQuery()));
  filteredVariants = computed<ProductVariantDto[]>(() => {
    const p = this.product();
    if (!p) return [];
    const q = this.variantQuery();
    if (!q.trim()) return p.variants;
    return p.variants.filter((v) => matchesVariant(q, v));
  });

  // ── Orden de variantes ──────────────────────────────────────────────────
  // 'off' = orden del backend (color → talla); 'desc'/'asc' = stock en la
  // sucursal activa. El desempate usa el índice original, así el suborden
  // (color y luego talla) se preserva tal cual lo entrega el backend.
  sortMode = signal<VariantSort>('off');

  /** Opciones del menú de orden (explícitas: el usuario no adivina el ciclo). */
  readonly sortOptions: readonly { mode: VariantSort; label: string }[] = [
    { mode: 'off', label: 'Orden por defecto' },
    { mode: 'desc', label: 'Stock: mayor a menor' },
    { mode: 'asc', label: 'Stock: menor a mayor' },
  ];

  sortMenuOpen = signal(false);
  private sortTrigger = viewChild<ElementRef<HTMLButtonElement>>('sortTrigger');
  private sortOptionEls = viewChildren<ElementRef<HTMLButtonElement>>('sortOption');

  toggleSortMenu(): void {
    const next = !this.sortMenuOpen();
    this.sortMenuOpen.set(next);
    if (!next) return;
    const current = this.sortOptions.findIndex((o) => o.mode === this.sortMode());
    this.focusSortOption(current < 0 ? 0 : current);
  }

  selectSort(mode: VariantSort): void {
    this.sortMode.set(mode);
    this.sortMenuOpen.set(false);
  }

  /** Navegación del menú con teclado (patrón menu / menuitemradio). */
  onSortMenuKeydown(event: KeyboardEvent): void {
    const last = this.sortOptions.length - 1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusSortOption(this.nextIndex(1, last));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusSortOption(this.nextIndex(-1, last));
        break;
      case 'Home':
        event.preventDefault();
        this.focusSortOption(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusSortOption(last);
        break;
      case 'Escape':
        event.preventDefault();
        this.closeSortMenu();
        break;
    }
  }

  private currentSortIndex(): number {
    const focused = this.sortOptionEls().findIndex(
      (el) => el.nativeElement === document.activeElement,
    );
    return focused >= 0 ? focused : this.sortOptions.findIndex((o) => o.mode === this.sortMode());
  }

  private nextIndex(step: number, last: number): number {
    const current = this.currentSortIndex();
    return current < 0 ? 0 : (current + step + last + 1) % (last + 1);
  }

  private focusSortOption(index: number): void {
    setTimeout(() => this.sortOptionEls()[index]?.nativeElement.focus());
  }

  closeSortMenu(): void {
    if (!this.sortMenuOpen()) return;
    this.sortMenuOpen.set(false);
    this.sortTrigger()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!this.sortMenuOpen()) return;
    if (target instanceof HTMLElement && target.closest('[data-sort-menu]')) return;
    this.sortMenuOpen.set(false);
  }

  sortIcon = computed(() => {
    switch (this.sortMode()) {
      case 'desc':
        return 'arrow_downward';
      case 'asc':
        return 'arrow_upward';
      default:
        return 'sort';
    }
  });

  /** Texto del chip con orden activo (sin orden el template escribe "Ordenar"). */
  sortText = computed(() => (this.sortMode() === 'desc' ? 'Stock ↓' : 'Stock ↑'));

  sortLabel = computed(() => {
    const branch = this.branchMap()[this.activeBranchId() ?? ''];
    const suffix = branch ? ` en ${branch}` : '';
    switch (this.sortMode()) {
      case 'desc':
        return `Ordenado por stock: mayor a menor${suffix}`;
      case 'asc':
        return `Ordenado por stock: menor a mayor${suffix}`;
      default:
        return branch ? `Ordenar variantes (stock de ${branch})` : 'Ordenar variantes';
    }
  });

  sortedVariants = computed<ProductVariantDto[]>(() => {
    const mode = this.sortMode();
    const branchId = this.activeBranchId();
    if (!branchId) return this.filteredVariants();
    return sortVariantsByStock(this.filteredVariants(), mode, (v) => this.stockAt(v, branchId));
  });

  // ── Modales por query param (?modal=...) ─────────────────────────────────
  /** El query param `modal` como señal: toda la visibilidad se deriva de él. */
  private readonly modalParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('modal'))),
    { initialValue: null },
  );

  private readonly isModal = (name: string) => computed(() => this.modalParam() === name);

  showUpdateProduct = this.isModal('product');
  showDeleteProduct = this.isModal('delete-product');
  showToggleStatus = this.isModal('toggle-status');
  /** Modal de agregar talla/color abierto o no */
  showAddVariant = this.isModal('add-variant');
  /** Modal de edición masiva de precios abierto o no */
  showBulkPrices = this.isModal('bulk-prices');
  /** Panel de edición completa (datos + precios) abierto o no */
  showFullEdit = this.isModal('edit-full');

  /**
   * Variante de ?modal=<prefix>:<id>. Se resuelve contra `product()`, así que
   * también abre al recargar con el modal en la URL: el producto llega después
   * del query param y el computed vuelve a evaluarse.
   */
  private readonly variantFor = (prefix: string) =>
    computed(() => {
      const id = getModalId(this.modalParam(), prefix);
      return id ? this.findVariant(id) : null;
    });

  /** Variante actualmente en edición — null = modal cerrado */
  editingVariant = this.variantFor('edit');
  /** Variante pendiente de borrar — null = modal cerrado */
  deletingVariant = this.variantFor('delete');
  /** Variante cuyo stock se está ajustando — null = modal cerrado */
  adjustingStockVariant = this.variantFor('adjust');

  activeBranchStock = computed(() => {
    const v = this.adjustingStockVariant();
    if (!v) return 0;
    const branchId = this.activeBranchId();
    if (!branchId) return 0;
    return v.branchStocks.find((s) => s.branchId === branchId)?.stock ?? 0;
  });

  /** Nombre de la sucursal activa de la variante en ajuste */
  activeBranchName = computed(() => {
    const v = this.adjustingStockVariant();
    if (!v) return null;
    const branchId = this.activeBranchId();
    if (!branchId) return null;
    return v.branchStocks.find((s) => s.branchId === branchId)?.branchName ?? null;
  });

  private findVariant(id: GUID): ProductVariantDto | null {
    return this.product()?.variants.find((v) => v.id === id) ?? null;
  }

  closeModal(): void {
    closeModal(this.router, this.route);
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.loadProduct(idParam);
    }
  }

  private loadProduct(id: GUID): void {
    this.loading.set(true);
    this.productService.getById(id).subscribe({
      next: (p) => {
        this.product.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private get productId(): GUID {
    return this.product()!.id;
  }

  /**
   * Error de API: mensaje del backend (detail → title → message) o el texto de
   * respaldo del llamador, y libera el estado de envío.
   */
  private handleApiError(err: unknown, fallback: string): void {
    this.submitting.set(false);
    const e = err as { error?: { detail?: string; title?: string }; message?: string };
    this.toastService.error(e?.error?.detail || e?.error?.title || e?.message || fallback);
  }

  // ── Child output handlers ───────────────────────────────────────────────
  openDeleteProduct(): void {
    openModal(this.router, this.route, 'delete-product');
  }

  openToggleStatus(): void {
    openModal(this.router, this.route, 'toggle-status');
  }

  openAddVariant(): void {
    openModal(this.router, this.route, 'add-variant');
  }

  openFullEdit(): void {
    openModal(this.router, this.route, 'edit-full');
  }

  onEditVariant(v: ProductVariantDto): void {
    openModal(this.router, this.route, `edit:${v.id}`);
  }

  onDeleteVariant(v: ProductVariantDto): void {
    this.submitting.set(true);
    this.productService.canDeleteVariant(v.id).subscribe({
      next: (check) => {
        this.submitting.set(false);
        if (!check.canDelete) {
          this.toastService.error(
            check.reason === 'HAS_MOVEMENTS'
              ? 'Esta variante tiene movimientos de stock asociados y no se puede eliminar.'
              : check.reason === 'HAS_TRANSFER'
                ? 'Esta variante está referenciada en una transferencia y no se puede eliminar.'
                : 'No se puede eliminar esta variante.',
          );
          return;
        }
        openModal(this.router, this.route, `delete:${v.id}`);
      },
      error: () => {
        this.submitting.set(false);
        this.toastService.error('No se pudo verificar la variante. Intente de nuevo.');
      },
    });
  }

  onAdjustStock(v: ProductVariantDto): void {
    openModal(this.router, this.route, `adjust:${v.id}`);
  }

  onAddVariantSave(dto: CreateProductVariantDto): void {
    this.submitting.set(true);
    this.productService.createVariants(this.productId, { variants: [dto] }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.toastService.success('Talla/color agregada');
        this.loadProduct(this.productId);
      },
      error: (err: unknown) => {
        this.handleApiError(err, 'Error al agregar la talla/color.');
      },
    });
  }

  // ── API calls ────────────────────────────────────────────────────────────
  /** Un único camino de guardado para el producto: ?modal=edit-full y ?modal=product. */
  onFullSave(dto: UpdateProductDto): void {
    this.submitting.set(true);
    this.productService.update(this.productId, dto).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.toastService.success('Producto actualizado');
        this.loadProduct(this.productId);
      },
      error: (err: unknown) => {
        this.handleApiError(err, 'Error al actualizar el producto.');
      },
    });
  }

  onDeleteProduct(): void {
    this.submitting.set(true);
    this.productService.delete(this.productId).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toastService.success('Producto eliminado');
        this.router.navigate(['inventory', 'products']);
      },
      error: (err: unknown) => {
        this.handleApiError(err, 'Error al eliminar el producto.');
      },
    });
  }

  onToggleStatus(): void {
    const p = this.product();
    if (!p) return;
    this.submitting.set(true);
    this.productService.updateStatus(p.id, !p.isActive).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.toastService.success(p.isActive ? 'Producto desactivado' : 'Producto activado');
        this.loadProduct(p.id);
      },
      error: (err: unknown) => {
        this.handleApiError(err, 'Error al cambiar el estado del producto.');
      },
    });
  }

  onBulkPricesSave(items: BulkUpdateVariantPriceItem[]): void {
    this.submitting.set(true);
    this.productService.updateVariantPrices(this.productId, items).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.toastService.success(
          items.length === 1 ? 'Precio actualizado' : `Precios actualizados (${items.length})`,
        );
        this.loadProduct(this.productId);
      },
      error: (err: unknown) => {
        this.handleApiError(err, 'Error al actualizar los precios.');
      },
    });
  }

  onUpdateVariant(dto: UpdateProductVariantDto): void {
    const variantId = this.editingVariant()!.id;
    this.submitting.set(true);
    this.productService.updateVariant(this.productId, variantId, dto).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.loadProduct(this.productId);
      },
      error: (err: unknown) => {
        this.handleApiError(err, 'Error al actualizar la talla/color.');
      },
    });
  }

  onConfirmDeleteVariant(): void {
    const variantId = this.deletingVariant()!.id;
    this.submitting.set(true);
    this.productService.deleteVariant(this.productId, variantId).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.toastService.success('Talla/color eliminada');
        this.loadProduct(this.productId);
      },
      error: (err: unknown) => {
        // Caso especial: 409 = la variante ya tiene movimientos o transferencias.
        const e = err as {
          status?: number;
          error?: { detail?: string; title?: string };
        };
        if (e.status === 409) {
          this.submitting.set(false);
          this.toastService.error(
            e.error?.detail ||
              e.error?.title ||
              'Esta variante está asociada a movimientos o transferencias y no se puede eliminar.',
          );
          this.closeModal();
          return;
        }
        this.handleApiError(err, 'Error al eliminar la talla/color.');
      },
    });
  }

  onSaveStockAdjust(dto: UpdateProductVariantStockDto): void {
    const variantId = this.adjustingStockVariant()!.id;
    this.submitting.set(true);
    this.productService.adjustVariantStock(this.productId, variantId, dto).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeModal();
        this.toastService.success('Stock ajustado');
        this.loadProduct(this.productId);
      },
      error: (err: unknown) => {
        this.handleApiError(err, 'Error al ajustar el stock.');
      },
    });
  }

  onViewHistory(pv: ProductVariantDto) {
    this.router.navigate(['inventory', 'products', pv.id, 'movements']);
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['inventory', 'products']);
    }
  }

  /** Stock de la variante en una sucursal concreta (0 si no está). */
  stockAt(v: ProductVariantDto, branchId: GUID): number {
    return v.branchStocks.find((s) => s.branchId === branchId)?.stock ?? 0;
  }

  /** Corte entre colores: true en la primera fila visible de cada color
      (sirve con buscador y con orden por stock: compara orden visible). */
  isFirstOfColor(index: number): boolean {
    const list = this.sortedVariants();
    return index > 0 && list[index].colorId !== list[index - 1].colorId;
  }

  /** Etiqueta de género: `Gender.Unisex` es 0, así que no se puede usar `||`. */
  genderLabel(gender: Gender | null | undefined): string {
    return gender == null ? '—' : GENDER_LABELS[gender];
  }
}
