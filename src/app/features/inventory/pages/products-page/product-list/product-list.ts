import { Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProductService } from '../../../services/product-service';
import { ListProductDto } from '../../../dtos/products/list-product-dto';
import { ProductDetailDto } from '../../../dtos/products/product-detail-dto';
import { UpdateProductDto } from '../../../dtos/products/update-product-dto';
import ProductItem from './product-item/product-item';
import { Paginator } from '@shared/components/app-paginator/app-paginator';
import {
  parseProductQuery,
  ProductQueryParams,
  sameProductQuery,
  serializeProductQuery,
} from '../../../dtos/products/product-dto';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { ProductFilterBar } from '../product-filter-bar/product-filter-bar';
import CreateProductModal from '../create-product-modal/create-product-modal';
import { ProductEditPanel } from '../product-detail/product-edit-panel/product-edit-panel';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ToastService } from '@core/services/toast-service';
import { ModalStackService, useStackedModal } from '@core/modal-stack-service';
import { readQuery, writeQuery } from '@shared/utils/list-query';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ProductItem, SkeletonList, Paginator, ProductFilterBar, CreateProductModal, ProductEditPanel],
  template: `
    <div class="flex flex-col gap-3">
      <!-- Header: título + acciones -->
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-lg font-black text-text-main">Productos</h1>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            (click)="goToCatalogs()"
            class="btn btn-secondary btn-sm flex items-center gap-1"
          >
            <span class="material-icons text-base">category</span>
            Catálogos
          </button>

          @if (perm.canCreate('inventory', 'products')) {
            <button type="button" (click)="openCreateModal()" class="btn btn-primary btn-sm">
              + Nuevo producto
            </button>
          }
        </div>
      </div>

      <!-- Filtros -->
      <app-product-filter-bar
        [params]="query()"
        (change)="patchQuery($event)"
        (clear)="clearFilters()"
      />

      <!-- Lista -->
      @if (loading()) {
        <app-skeleton-list [rows]="4" [columns]="3" />
      } @else if (error()) {
        <div
          class="flex flex-col items-center gap-3 p-8 rounded border border-border bg-bg-surface shadow-sm"
        >
          <span class="material-icons text-3xl text-feedback-error-text">error_outline</span>
          <p class="text-sm text-text-main">{{ error() }}</p>
          <button class="btn btn-primary btn-sm" (click)="load()">Reintentar</button>
        </div>
      } @else if (products().length === 0) {
        <!-- Empty state -->
        <div
          class="flex flex-col items-center gap-3 p-12 rounded border border-border bg-bg-surface shadow-sm"
        >
          <span class="material-icons text-4xl text-text-soft opacity-60">inventory_2</span>
          <p class="font-inter text-sm font-medium text-text-muted">No se encontraron productos.</p>
          @if (hasActiveFilters()) {
            <button
              class="font-inter text-xs font-bold text-accent-ui transition-colors duration-150 hover:underline"
              (click)="clearFilters()"
            >
              Limpiar filtros
            </button>
          }
        </div>
      } @else {
        <!-- Wrapper tabla -->
        <div
          class="flex flex-col overflow-hidden rounded border border-border bg-bg-surface shadow-sm"
        >
          <!-- Cabezal mobile (Nombre | Stock). Sin @if: acá products() nunca
               está vacío porque el empty state es otra rama. -->
          <div class="flex items-center gap-2 px-4 pr-8 pb-1.5 lg:hidden" aria-hidden="true">
            <span class="flex-1 table-header">Nombre</span>
            <span class="table-header">Stock</span>
          </div>

          <!-- Header columnas — solo desktop. Misma grilla que las filas (gridColumns). -->
          <div
            class="hidden px-4 py-3 border-b border-border bg-bg-muted lg:grid table-header"
            [style.grid-template-columns]="gridColumns"
          >
            <span>Código</span>
            <span>Marca</span>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>Colores</span>
            <span class="pr-4 text-right">Precio (Bs)</span>
            <span class="pr-4 text-right">Stock</span>
            <span>Estado</span>
            <span></span>
          </div>

          <!-- Items -->
          <ul class="flex flex-col divide-y divide-border font-inter text-sm text-text-main">
            @for (p of products(); track p.id; let i = $index) {
              <app-product-item
                class="row-enter"
                [style.animation-delay.ms]="i * 30"
                [product]="p"
                [gridColumns]="gridColumns"
                (viewDetail)="goToDetail($event)"
                (editProduct)="goToEdit($event)"
              />
            }
          </ul>
        </div>
      }

      <!-- Paginador -->
      @if (!loading() && totalItems() > 0) {
        <app-paginator
          [page]="query().page"
          [pageSize]="query().pageSize"
          [totalItems]="totalItems()"
          (pageChange)="patchQuery({ page: $event })"
          (pageSizeChange)="patchQuery({ pageSize: $event, page: 1 })"
        />
      }
    </div>

    @if (showCreateModal()) {
      <app-create-product-modal (close)="closeCreateModal()" />
    }

    @if (editingProduct(); as editing) {
      <app-product-edit-panel
        [product]="editing"
        [submitting]="editSubmitting()"
        (save)="onEditSave($event)"
        (close)="closeEditModal()"
      />
    }
  `,
  styles: [
    `
      @keyframes slide-up {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .row-enter {
        animation: slide-up 220ms ease both;
      }
    `,
  ],
})
export default class ProductList implements OnDestroy {
  private productService = inject(ProductService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private stack = inject(ModalStackService);
  private toast = inject(ToastService);
  readonly perm = inject(PermissionService);

  /** El queryParamMap es la fuente de verdad (filtros y modal). */
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: null });

  products = signal<ListProductDto[]>([]);
  totalItems = signal(0);
  loading = signal(false);
  error = signal<string | null>(null);

  /**
   * Estado de la lista derivado de la URL. Se escribe con `patchQuery`, nunca
   * a mano: así refresh y "atrás" desde un detalle restauran el mismo estado.
   * `sameProductQuery` evita recargas cuando la URL no cambió en sustancia
   * (abrir/cerrar el modal no vuelve a pedir productos).
   */
  readonly query = computed<ProductQueryParams>(
    () => parseProductQuery(readQuery(this.queryParams())),
    { equal: sameProductQuery },
  );

  /** Modal de crear producto (signal, sin URL). */
  showCreateModal = signal(false);
  private createModal = useStackedModal(this.stack, this.showCreateModal);

  /** Edición in-place (datos + precios): se trae el detalle por backend al abrir. */
  editingProduct = signal<ProductDetailDto | null>(null);
  editSubmitting = signal(false);
  private unregisterEdit = () => {};

  ngOnDestroy(): void {
    this.createModal.destroy();
    this.unregisterEdit();
  }

  openCreateModal(): void {
    this.createModal.open();
  }

  closeCreateModal(): void {
    this.createModal.close();
  }

  /** ✎ de la fila: trae el detalle y abre el panel acá mismo (sin ir al detalle). */
  goToEdit(id: GUID): void {
    this.productService.getById(id).subscribe({
      next: (detail) => {
        this.editingProduct.set(detail);
        this.unregisterEdit = this.stack.push(() => this.closeEditModal());
      },
      error: (err: unknown) => {
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.toast.error(e?.error?.detail || e?.error?.title || e?.message || 'No se pudo cargar el producto.');
      },
    });
  }

  closeEditModal(): void {
    this.unregisterEdit();
    this.editingProduct.set(null);
  }

  onEditSave(dto: UpdateProductDto): void {
    const editing = this.editingProduct();
    if (!editing || this.editSubmitting()) return;
    this.editSubmitting.set(true);
    this.productService.update(editing.id, dto).subscribe({
      next: () => {
        this.editSubmitting.set(false);
        this.closeEditModal();
        this.toast.success('Producto actualizado');
        this.load();
      },
      error: (err: unknown) => {
        this.editSubmitting.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.toast.error(e?.error?.detail || e?.error?.title || e?.message || 'Error al actualizar el producto.');
      },
    });
  }

  /**
   * Grilla de la tabla: la comparten el header y las filas para que no puedan
   * desalinearse. Código | Marca | Nombre | Categoría | Colores | Precio (Bs) | Stock | Estado | Acción
   */
  readonly gridColumns = '5rem 6rem 1fr 6.5rem 14rem 8.5rem 4.5rem 5rem 3rem';

  hasActiveFilters = computed(() => {
    const q = this.query();
    // Ojo: Gender.Unisex es 0, así que no vale un chequeo por truthiness.
    return !!(q.filter || q.categoryId || q.brandId || q.gender !== undefined || q.includeInactive);
  });

  patchQuery(patch: Partial<ProductQueryParams>) {
    writeQuery(this.router, this.route, serializeProductQuery({ ...this.query(), ...patch }));
  }

  clearFilters() {
    this.patchQuery({
      filter: undefined,
      categoryId: undefined,
      brandId: undefined,
      gender: undefined,
      includeInactive: undefined,
      sortBy: undefined,
      sortDescending: undefined,
      page: 1,
    });
  }

  constructor() {
    effect(() => {
      const q = this.query();
      untracked(() => this.load(q));
    });
  }

  load(q: ProductQueryParams = this.query()) {
    this.loading.set(true);
    this.error.set(null);
    this.productService.getProducts(q).subscribe({
      next: (data) => {
        this.products.set(data.items);
        this.totalItems.set(data.totalCount); // ajusta al nombre real de tu PagedResult
        this.loading.set(false);
      },
      error: (err: any) => {
        this.loading.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.error.set(
          e?.error?.detail || e?.error?.title || e?.message || 'Error al cargar productos.',
        );
      },
    });
    // Marcas y categorías las carga la barra de filtros (siempre montada).
  }

  goToDetail(id: GUID) {
    this.router.navigate(['inventory', 'products', id, 'detail']);
  }
  goToCatalogs() {
    this.router.navigate(['inventory', 'products', 'catalog']);
  }
}
