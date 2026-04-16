import {Component, effect, input, output, signal, untracked} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ProductSearchResult} from './product-search-result';
import {CurrencyPipe, NgClass} from '@angular/common';
import {Gender} from '../../interfaces/gender';

@Component({
  selector: 'app-product-search',
  imports: [
    FormsModule,
    CurrencyPipe,
    NgClass
  ],
  template: `
    <div class="relative w-full" (focusout)="handleFocusOut($event)">
      <input
        #inputRef
        type="text"
        [ngModel]="productSearch()"
        (ngModelChange)="onSearchInput($event)"
        (focus)="onFocus()"
        (keydown)="onKeyDown($event)"
        placeholder="Buscar producto..."
        class="w-full px-2 py-1.5 border border-transparent rounded text-[11px] text-gray-900
               focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400
               hover:border-gray-200 transition-colors"
        [class.bg-blue-50]="selectedId()"
      />

      @if (showDropdown() && (searchResults().length > 0 || isSearching())) {
        <div class="absolute z-[100] left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-52 overflow-y-auto">
          @if (isSearching()) {
            <div class="px-3 py-2 text-[10px] text-gray-400 animate-pulse">Buscando productos...</div>
          }
          @for (product of searchResults(); track product.id; let i = $index) {
            <button
              type="button"
              (mousedown)="$event.preventDefault()"
              (click)="selectProduct(product)"
              (mouseenter)="activeIndex.set(i)"
              class="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0
           flex items-center justify-between gap-4 transition-all"
              [class.bg-blue-600]="activeIndex() === i"
              [class.text-white]="activeIndex() === i"
              [class.bg-white]="activeIndex() !== i"
            >

              <!-- LEFT -->
              <div class="flex flex-col min-w-0 flex-1">

                <!-- NOMBRE + CODIGO -->
                <div class="flex items-center gap-2 min-w-0">

                  <!-- código -->
                  <span
                    class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0"
                    [ngClass]="{
                    'bg-white/20 text-white': activeIndex() === i
                  }"
                                  >
                  {{ product.internalCode }}
                </span>

                  <!-- nombre -->
                  <span class="font-semibold text-[13px] truncate">
          {{ product.name }}
        </span>

                  <!-- genero -->
                  <span
                    class="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border shrink-0"
                    [class.border-white]="activeIndex() === i"
                    [class.border-gray-200]="activeIndex() !== i"
                  >
          {{ Gender[product.gender] }}
        </span>
                </div>

                <!-- META -->
                <div class="flex items-center gap-2 mt-1">
        <span class="text-[10px] opacity-80 uppercase tracking-wider font-medium">
          {{ product.brandName }}
        </span>
                  <span class="text-[10px] opacity-50">•</span>
                  <span class="text-[10px] opacity-80 italic">
          {{ product.categoryName }}
        </span>
                </div>
              </div>

              <!-- RIGHT -->
              <div class="flex flex-col items-end shrink-0">
      <span class="text-[14px] font-bold">
        {{ product.basePrice | currency:'Bs' }}
      </span>
                <span class="text-[9px] opacity-70">
        {{ product.productVariants.length }} vars.
      </span>
              </div>

            </button>
          }

          @if (!isSearching() && searchResults().length === 0 && productSearch().length > 2) {
            <div class="px-3 py-2 text-[10px] text-gray-500 italic">
              No se encontraron resultados
            </div>
          }



        </div>
      }
    </div>
  `,
  styles: ``,
})
export class ProductSearch {
  searchResults = input.required<ProductSearchResult[]>();
  isSearching = input<boolean>(false);
  selectedId = input<number | null>(null);
  selectedProduct = input<ProductSearchResult | null>(null);

  // Outputs
  searchChanged = output<string>();
  productSelected = output<ProductSearchResult | null>();

  // Estado interno
  productSearch = signal('');
  showDropdown = signal(false);
  activeIndex = signal(0);
  protected readonly Gender = Gender;


  constructor() {
    // Sincroniza el texto del input con el producto seleccionado externamente
    effect(() => {
      const selected = this.selectedProduct();
      untracked(() => {
        if (selected) {
          this.productSearch.set(selected.name);
        } else if (!this.selectedId()) {
          this.productSearch.set('');
        }
      });
    });
  }

  onFocus() {
    this.showDropdown.set(true);
    if (this.searchResults().length > 0) {
      this.activeIndex.set(0);
    }
  }

  handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as HTMLElement;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;

    this.showDropdown.set(false);

    // Lógica de "rollback": Si el usuario sale sin seleccionar nada nuevo,
    // restauramos el nombre del producto que ya estaba seleccionado.
    const current = this.selectedProduct();
    if (current) {
      this.productSearch.set(current.name);
    } else if (!this.selectedId()) {
      this.productSearch.set('');
    }
  }

  onSearchInput(value: string) {
    this.productSearch.set(value);
    this.activeIndex.set(0);
    this.showDropdown.set(true);
    this.searchChanged.emit(value);

    if (!value.trim()) {
      this.productSelected.emit(null);
    }
  }

  selectProduct(product: ProductSearchResult) {
    this.productSearch.set(product.name);
    this.productSelected.emit(product);
    this.showDropdown.set(false);
  }

  onKeyDown(event: KeyboardEvent) {
    const results = this.searchResults();
    if (!this.showDropdown()) {
      if (event.key === 'ArrowDown') this.showDropdown.set(true);
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => (i < results.length - 1 ? i + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => (i > 0 ? i - 1 : results.length - 1));
        break;
      case 'Enter':
        event.preventDefault();
        if (results[this.activeIndex()]) {
          this.selectProduct(results[this.activeIndex()]);
        }
        break;
      case 'Escape':
      case 'Tab':
        this.showDropdown.set(false);
        break;
    }
  }

}
