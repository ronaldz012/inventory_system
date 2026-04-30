import { Component, ElementRef, inject, input, output, signal, viewChild} from '@angular/core';
import {ProductService} from '../../services/product-service';
import {ProductVariantBySkuDto} from '../../dtos/products/product-variant-by-sku-dto';
import {catchError, EMPTY, Subject, switchMap, tap} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-product-variant-search',
  imports: [
    FormsModule
  ],
  templateUrl: './product-variant-search.html',
  styles: ``,
})
export class ProductVariantSearch {
  private productService = inject(ProductService);

  placeholder = input<string>('Código...');
  productFound = output<ProductVariantBySkuDto>();

  code = '';
  loading = signal(false);
  errorMsg = signal('');

  private inputRef = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.errorMsg.set('');
        }),
        switchMap(code =>
          this.productService.getVariantBySku(code).pipe(
            catchError(err => {
              const msg = err.status === 404
                ? `No se encontró "${code}"`
                : 'Error al buscar el producto';
              this.errorMsg.set(msg);
              this.loading.set(false);
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(variant => {
        this.loading.set(false);
        this.productFound.emit(variant);
        this.inputRef().nativeElement.focus();
      });
  }

  onEnter(): void {
    const trimmed = this.code.trim();
    if (!trimmed || this.loading()) return;

    this.code = '';
    this.search$.next(trimmed);
  }
}
