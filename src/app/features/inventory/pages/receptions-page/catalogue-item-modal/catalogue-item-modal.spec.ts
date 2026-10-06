import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import CatalogueItemModal from './catalogue-item-modal';
import { ProductService } from '@features/inventory/services/product-service';
import { ProductSearchResult } from '../../../components/product-search/product-search-result.component';
import { Gender } from '@features/inventory/interfaces/gender';
import { ItemForm } from '@features/inventory/models/variant-form.model';

const fakeProduct: ProductSearchResult = {
  id: 'p1',
  name: 'Zapato',
  internalCode: 'ZAP',
  description: '',
  basePrice: 100,
  brandName: 'Nike',
  categoryName: 'Calzado',
  gender: Gender.Hombre,
  productVariants: [
    {
      id: 'v1',
      sku: 'SKU-1',
      size: '42',
      sizeId: 's42',
      colorId: 'c-azul',
      colorName: 'Azul',
      price: 100,
    },
    {
      id: 'v2',
      sku: 'SKU-2',
      size: '44',
      sizeId: 's44',
      colorId: 'c-azul',
      colorName: 'Azul',
      price: 100,
    },
  ],
};

describe('CatalogueItemModal — inclusión por cantidad', () => {
  let searchResults: ProductSearchResult[];

  beforeEach(async () => {
    searchResults = [];
    await TestBed.configureTestingModule({
      imports: [CatalogueItemModal],
      // modo add: no hace HTTP (solo initFromEdit llamaría a getById)
      providers: [
        { provide: ProductService, useValue: { searchProduct: () => of(searchResults) } },
      ],
    }).compileComponents();
  });

  function setup(): CatalogueItemModal {
    const fixture = TestBed.createComponent(CatalogueItemModal);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const fieldEvent = (value: string): Event => ({ target: { value } }) as unknown as Event;

  it('onConfirm solo incluye variantes con cantidad', () => {
    const modal = setup();
    const emitted: { index: number | null; item: ItemForm }[] = [];
    modal.confirm.subscribe((e) => emitted.push(e));

    modal.onProductSelected(fakeProduct);
    modal.updateVariantField(0, 'quantityReceived', fieldEvent('5'));
    modal.updateVariantField(0, 'unitCost', fieldEvent('10'));
    // la segunda variante queda sin cantidad
    modal.onConfirm();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].index).toBeNull();
    const item = emitted[0].item;
    expect(item.variants).toHaveLength(1);
    expect(item.variants[0].sku).toBe('SKU-1');
    expect(item.variants[0].quantityReceived).toBe(5);
    expect(item.variants[0].unitCost).toBe(10);
  });

  it('sin ninguna cantidad no emite y muestra el error', () => {
    const modal = setup();
    const emitted: { index: number | null; item: ItemForm }[] = [];
    modal.confirm.subscribe((e) => emitted.push(e));

    modal.onProductSelected(fakeProduct);
    modal.onConfirm();

    expect(emitted).toHaveLength(0);
    expect(modal.error()).toBe('Cargá al menos una cantidad.');
  });

  describe('búsqueda por pasos', () => {
    function setupDom() {
      const fixture = TestBed.createComponent(CatalogueItemModal);
      fixture.detectChanges();
      return {
        fixture,
        modal: fixture.componentInstance,
        root: fixture.nativeElement as HTMLElement,
      };
    }

    const searchInput = (root: HTMLElement): HTMLInputElement =>
      root.querySelector<HTMLInputElement>('#catalogue-search')!;

    function type(fixture: { detectChanges: () => void }, root: HTMLElement, text: string): void {
      vi.useFakeTimers();
      try {
        const el = searchInput(root);
        el.value = text;
        el.dispatchEvent(new Event('input'));
        vi.advanceTimersByTime(400);
        fixture.detectChanges();
      } finally {
        vi.useRealTimers();
      }
    }

    it('arranca en el paso de búsqueda', () => {
      const { modal, root } = setupDom();
      expect(modal.showSearchStep()).toBe(true);
      expect(searchInput(root)).not.toBeNull();
    });

    it('sin producto no renderiza grilla, resumen ni footer', () => {
      const { root } = setupDom();
      const text = (root.textContent ?? '').replace(/\s+/g, ' ');
      expect(root.querySelector('footer')).toBeNull();
      expect(text).not.toContain('Tallas/Colores');
      expect(text).not.toContain('Agregar producto');
      expect(text).toContain('Escribí al menos 2 caracteres');
    });

    it('buscar pinta filas con marca, nombre y conteo de tallas', () => {
      searchResults = [fakeProduct];
      const { fixture, root } = setupDom();
      type(fixture, root, 'zap');

      const text = (root.textContent ?? '').replace(/\s+/g, ' ');
      expect(text).toContain('Nike');
      expect(text).toContain('Zapato');
      expect(text).toContain('2 tallas');
    });

    it('Enter elige el primero y pasa a variantes', () => {
      searchResults = [fakeProduct];
      const { fixture, modal, root } = setupDom();
      type(fixture, root, 'zap');

      searchInput(root).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();

      expect(modal.showSearchStep()).toBe(false);
      expect(modal.itemModel().variants).toHaveLength(2);
    });

    it('Cambiar vuelve al paso de búsqueda', () => {
      searchResults = [fakeProduct];
      const { fixture, modal, root } = setupDom();
      type(fixture, root, 'zap');
      searchInput(root).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      fixture.detectChanges();
      expect(modal.showSearchStep()).toBe(false);

      const change = Array.from(root.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Cambiar',
      )!;
      change.click();
      fixture.detectChanges();

      expect(modal.showSearchStep()).toBe(true);
      expect(searchInput(root)).not.toBeNull();
    });
  });
});
