import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product-service';
import { ListProductDto } from '../../../dtos/products/list-product-dto';
import ProductItem from './product-item/product-item';
import { Paginator } from '@shared/components/app-paginator/app-paginator';
import { ProductQueryParams } from '../../../dtos/products/product-dto';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { ProductFilterBar } from '../product-filter-bar/product-filter-bar';
import { BrandService } from '@features/inventory/services/brand-service';
import { CategoryService } from '@features/inventory/services/category-service';
import { ColorService } from '@features/inventory/services/color-service';
import CreateProductModal from '../create-product-modal/create-product-modal';
import { PermissionService } from '@features/auth/services/permmision-service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [ProductItem, SkeletonList, Paginator, ProductFilterBar, Paginator, CreateProductModal],
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
            <button
              type="button"
              (click)="showCreateModal.set(true)"
              class="btn btn-primary btn-sm"
            >
              + Nuevo producto
            </button>
          }
        </div>
      </div>

      <!-- Filtros -->
      <app-product-filter-bar [params]="query()" (change)="patchQuery($event)" />

      <!-- Lista -->
      @if (loading()) {
        <app-skeleton-list [rows]="4" [columns]="3" />
      } @else if (error()) {
        <div class="flex flex-col items-center gap-3 p-8 rounded border border-border bg-bg-surface shadow-sm">
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
              (click)="
                patchQuery({
                  filter: undefined,
                  categoryId: undefined,
                  brandId: undefined,
                  gender: undefined,
                  includeInactive: undefined,
                  sortBy: undefined,
                  sortDescending: undefined,
                  page: 1,
                })
              "
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
          <!-- Header columnas — solo desktop -->
          <div
            class="hidden px-4 py-3 border-b border-border bg-bg-muted lg:grid grid-cols-[9rem_1fr_12rem_8rem_6rem_7rem_6.5rem] table-header"
          >
            <span>Código</span>
            <span>Nombre</span>
            <span>Marca / Cat.</span>
            <span class="pr-4 text-right">Talla/Color</span>
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
                [index]="i"
                (viewDetail)="goToDetail($event)"
                (viewMovements)="goToMovements($event)"
              />
            }
          </ul>
        </div>
      }

      <!-- Paginador -->
      @if (!loading() && totalItems() > 0) {
        <app-paginator
          [page]="query().page!"
          [pageSize]="query().pageSize!"
          [totalItems]="totalItems()"
          (pageChange)="patchQuery({ page: $event })"
          (pageSizeChange)="patchQuery({ pageSize: $event, page: 1 })"
        />
      }
    </div>

    @if (showCreateModal()) {
      <app-create-product-modal (close)="showCreateModal.set(false)" />
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
export default class ProductList implements OnInit {
  private productService = inject(ProductService);
  brandService = inject(BrandService);
  categoryService = inject(CategoryService);
  colorService = inject(ColorService);
  private router = inject(Router);
  readonly perm = inject(PermissionService);

  products = signal<ListProductDto[]>([]);
  totalItems = signal(0);
  loading = signal(false);
  error = signal<string | null>(null);

  query = signal<ProductQueryParams>({
    page: 1,
    pageSize: 10,
  });

  showCreateModal = signal(false);

  hasActiveFilters = computed(() => {
    const q = this.query();
    return !!(q.filter || q.categoryId || q.brandId || q.gender || q.includeInactive);
  });

  ngOnInit() {
    this.load();
  }

  patchQuery(patch: Partial<ProductQueryParams>) {
    this.query.update((q) => ({ ...q, ...patch }));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.productService.getProducts(this.query()).subscribe({
      next: (data) => {
        this.products.set(data.items);
        this.totalItems.set(data.totalCount); // ajusta al nombre real de tu PagedResult
        this.loading.set(false);
      },
      error: (err: any) => { this.loading.set(false); const e = err as { error?: { detail?: string; title?: string }; message?: string }; this.error.set(e?.error?.detail || e?.error?.title || e?.message || 'Error al cargar productos.'); },
    });
    this.brandService.load();
    this.categoryService.load();
    this.colorService.load();
  }

  goToDetail(id: GUID) {
    this.router.navigate(['inventory', 'products', id, 'detail']);
  }
  goToMovements(id: GUID) {
    this.router.navigate(['inventory', 'products', id, 'movements']);
  }
  goToCatalogs() {
    this.router.navigate(['inventory', 'products', 'catalog']);
  }
}
