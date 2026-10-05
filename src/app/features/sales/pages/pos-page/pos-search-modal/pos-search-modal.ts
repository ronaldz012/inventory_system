import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { debounceTime, distinctUntilChanged, finalize, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProductService } from '@features/inventory/services/product-service';
import { ProductVariantSearchDto } from '@features/inventory/dtos/products/product-variant-search-dto';

@Component({
  selector: 'app-pos-search-modal',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './pos-search-modal.html',
  styles: `
    @keyframes modal-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .modal-enter {
      animation: modal-in 180ms ease both;
    }
  `,
})
export class PosSearchModal {
  private productService = inject(ProductService);
  private destroyRef = inject(DestroyRef);
  private search$ = new Subject<string>();

  variantSelected = output<string>();
  closed = output<void>();

  query = signal('');
  isSearching = signal(false);
  results = signal<ProductVariantSearchDto[]>([]);

  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  showEmpty = computed(
    () => !this.isSearching() && this.results().length === 0 && this.query().length >= 2,
  );

  constructor() {
    // El modal nace con cada apertura (@if): enfocar acá es determinista, a
    // diferencia del atributo `autofocus`, que no corre en contenido dinámico.
    // (En iOS el teclado puede no abrirse sin gesto directo: limitación del SO.)
    afterNextRender(() => this.searchInput()?.nativeElement.focus());

    this.search$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.length < 2) {
            this.results.set([]);
            this.isSearching.set(false);
            return [];
          }
          this.isSearching.set(true);
          return this.productService
            .searchVariants(q)
            .pipe(finalize(() => this.isSearching.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => this.results.set(r));
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.search$.next(value);
  }

  /** Enter = "listo": baja el teclado (la búsqueda ya es en vivo). */
  onSearchEnter(event: Event): void {
    (event.target as HTMLInputElement).blur();
  }

  /** Color del stock por cantidad: 0 · bajo (1-4) · normal (5+). */
  stockClass(stock: number): string {
    return stock <= 0
      ? 'text-feedback-error-text'
      : stock < 5
        ? 'text-feedback-warning-text'
        : 'text-feedback-success-text';
  }

  select(sku: string): void {
    this.variantSelected.emit(sku);
    this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
