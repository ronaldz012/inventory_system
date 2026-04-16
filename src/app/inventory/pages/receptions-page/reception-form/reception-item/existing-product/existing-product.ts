import {
  Component,
  DestroyRef, EventEmitter,
  inject,
  input, model,
  OnInit, Output,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { ProductSearchResult } from '../../../../../components/product-search/product-search-result';
import { ProductService } from '../../../../../services/product-service';
import {ProductSearch} from '../../../../../components/product-search/product-search';
import {Gender} from '../../../../../interfaces/gender';

@Component({
  selector: 'app-existing-product',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, ProductSearch],
  templateUrl: './existing-product.html',
  styles: [`
    :host {
      display: contents;
    }
  `],
})
export class ExistingProduct implements OnInit {
  private productService = inject(ProductService);
  private destroyRef     = inject(DestroyRef);

  // ── Inputs ────────────────────────────────────────────────────────────
  productIdCtrl = input.required<FormControl<number | null>>();
  selectedProduct = input.required<ProductSearchResult | null>();

  // ── Outputs ───────────────────────────────────────────────────────────
  productSelected  = output<ProductSearchResult>();
  selectionCleared = output<void>();
  switchMode       = output<void>();
  remove           = output<void>();

  // ── Estado UI ─────────────────────────────────────────────────────────
  isSearching     = signal(false);
  searchResults   = signal<ProductSearchResult[]>([]);
  private searchInput$ = new Subject<string>();

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

  // Se llama desde el HTML cuando el nieto (app-product-search) emite texto
  handleSearchChanged(query: string): void {
    this.searchInput$.next(query);
  }

  // Se llama cuando se hace click en un producto de la lista
  handleProductSelected(product: ProductSearchResult | null): void {
    if (product) {
      // 1. Actualizamos el control de formulario (referencia)
      this.productIdCtrl().setValue(product.id);
      // 2. Emitimos el objeto completo para que el padre gestione variantes
      this.productSelected.emit(product);
      // 3. Limpiamos la lista de resultados
      this.searchResults.set([]);
    } else {
      this.clearSelection();
    }
  }

  clearSelection(): void {
    this.productIdCtrl().setValue(null);
    this.searchResults.set([]);
    this.selectionCleared.emit();
  }

  protected readonly Gender = Gender;

   switchToNewProductMode() {
     this.clearSelection()
    this.switchMode.emit()
  }
}
