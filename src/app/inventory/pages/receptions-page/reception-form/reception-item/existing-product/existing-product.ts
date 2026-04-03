import {
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { ProductSearchResult } from '../../../../../models/products/product-search-result';
import { ProductService } from '../../../../../services/product-service';

@Component({
  selector: 'app-existing-product',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule],
  templateUrl: './existing-product.html',
  styles: [`
    :host {
      display: contents;
    }
  `],
})
export class ExistingProduct implements OnInit {
  // ── Dependencies ──────────────────────────────────────────────────────
  private productService = inject(ProductService);
  private destroyRef     = inject(DestroyRef);

  // ── Inputs ────────────────────────────────────────────────────────────
  productIdCtrl = input.required<FormControl<number | null>>();

  // ── Outputs ───────────────────────────────────────────────────────────
  productSelected = output<ProductSearchResult>();
  switchMode      = output<void>(); // → cambiar a nuevo producto
  remove          = output<void>(); // → eliminar el item completo

  // ── Estado UI ─────────────────────────────────────────────────────────
  productSearch   = signal('');
  showDropdown    = signal(false);
  isSearching     = signal(false);
  searchResults   = signal<ProductSearchResult[]>([]);
  selectedProduct = signal<ProductSearchResult | null>(null);

  private searchInput$ = new Subject<string>();

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchInput$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q || q.length < 2) {
          this.searchResults.set([]);
          this.isSearching.set(false);
          return [];
        }
        this.isSearching.set(true);
        return this.productService.searchProduct(q).pipe(
          finalize(() => this.isSearching.set(false))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(results => this.searchResults.set(results));
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.productSearch.set(value);
    if (!value.trim()) {
      this.clearSelection();
    } else {
      this.showDropdown.set(true);
      this.searchInput$.next(value);
    }
  }

  selectProduct(product: ProductSearchResult): void {
    this.selectedProduct.set(product);
    this.productIdCtrl().setValue(product.id);
    this.productSearch.set(product.name);
    this.showDropdown.set(false);
    this.productSelected.emit(product);
  }

  clearSelection(): void {
    this.selectedProduct.set(null);
    this.productIdCtrl().setValue(null);
    this.productSearch.set('');
    this.searchResults.set([]);
  }

  handleBlur(): void {
    setTimeout(() => {
      this.showDropdown.set(false);
      if (!this.productIdCtrl().value) {
        this.productSearch.set('');
      } else if (this.selectedProduct() && this.productSearch() !== this.selectedProduct()!.name) {
        this.productSearch.set(this.selectedProduct()!.name);
      }
    }, 200);
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  getGenderLabel(gender: number | null): string {
    switch (gender) {
      case 0: return 'Unisex';
      case 1: return 'Hombre';
      case 2: return 'Mujer';
      default: return '—';
    }
  }
}
