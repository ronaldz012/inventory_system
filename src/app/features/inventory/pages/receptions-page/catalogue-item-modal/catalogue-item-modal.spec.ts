import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import CatalogueItemModal from './catalogue-item-modal';
import { ProductService } from '@features/inventory/services/product-service';
import { SizeService } from '@features/inventory/services/size-service';
import { ProductSearchResult } from '../../../components/product-search/product-search-result.component';
import { Gender } from '@features/inventory/interfaces/gender';
import { ItemForm } from '@features/inventory/models/variant-form.model';
import { ProductVariantCreatedDto } from '@features/inventory/dtos/products/create-product-variant-dto';

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
      sizeOrder: 3,
      colorId: 'c-azul',
      colorName: 'Azul',
      price: 100,
    },
    {
      id: 'v2',
      sku: 'SKU-2',
      size: '44',
      sizeId: 's44',
      sizeOrder: 5,
      colorId: 'c-azul',
      colorName: 'Azul',
      price: 100,
    },
  ],
};

describe('CatalogueItemModal — inclusión por cantidad', () => {
  let searchResults: ProductSearchResult[];
  let createdResponse: ProductVariantCreatedDto[];

  beforeEach(async () => {
    searchResults = [];
    createdResponse = [];
    await TestBed.configureTestingModule({
      imports: [CatalogueItemModal],
      // modo add: no hace HTTP (solo initFromEdit llamaría a getById)
      providers: [
        {
          provide: ProductService,
          useValue: {
            searchProduct: () => of(searchResults),
            createVariants: () => of(createdResponse),
          },
        },
        {
          provide: SizeService,
          useValue: {
            load: () => {},
            sizes: () => [{ id: 's42', sortOrder: 3 }, { id: 's43', sortOrder: 4 }, { id: 's44', sortOrder: 5 }],
          },
        },
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

  it('el costo único se aplica en vivo a todas las filas', () => {
    const modal = setup();
    modal.onProductSelected(fakeProduct);

    modal.onUniqueCostChange('45');

    const costs = modal.itemModel().variants.map((v) => v.unitCost);
    expect(costs).toEqual([45, 45]);
  });

  it('vaciar el costo único no borra los costos por fila', () => {
    const modal = setup();
    modal.onProductSelected(fakeProduct);
    modal.onUniqueCostChange('45');
    modal.updateVariantField(0, 'unitCost', { target: { value: '50' } } as unknown as Event);

    modal.onUniqueCostChange('');

    const costs = modal.itemModel().variants.map((v) => v.unitCost);
    expect(costs).toEqual([50, 45]);
  });

  it('al salir del costo único se limpia solo el campo, no las filas', () => {
    const fixture = TestBed.createComponent(CatalogueItemModal);
    fixture.detectChanges();
    const modal = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    modal.onProductSelected(fakeProduct);
    modal.onUniqueCostChange('45');
    fixture.detectChanges();

    const master = root.querySelector<HTMLInputElement>('input[placeholder="0.00"]')!;
    master.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(modal.masterCost()).toBeNull();
    expect(modal.itemModel().variants.map((v) => v.unitCost)).toEqual([45, 45]);
    expect(master.value).toBe('');
  });

  describe('crear variante sin refetch', () => {
    const newDto = { sizeId: 's43' as GUID, colorId: 'c-azul' as GUID, price: 120 };

    it('encaja la fila nueva en su lugar sin tocar lo tipeado', () => {
      // POST sin sizeOrder → fallback al catálogo local (s43 → 4)
      createdResponse = [{ productVariantId: 'v3', sku: 'SKU-3', size: '43', colorName: 'Azul' }];
      const modal = setup();
      modal.onProductSelected(fakeProduct);
      modal.updateVariantField(0, 'quantityReceived', fieldEvent('5'));
      modal.updateVariantField(0, 'unitCost', fieldEvent('10'));
      modal.showAddVariant.set(true);

      modal.onSaveAddVariant(newDto);

      const rows = modal.itemModel().variants;
      expect(rows.map((v) => v.sku)).toEqual(['SKU-1', 'SKU-3', 'SKU-2']);
      // lo tipeado intacto: las filas existentes conservan identidad/valores
      expect(rows[0].quantityReceived).toBe(5);
      expect(rows[0].unitCost).toBe(10);
      expect(rows[1]).toMatchObject({
        id: 'v3',
        sizeId: 's43',
        sizeName: '43',
        sizeOrder: 4,
        colorId: 'c-azul',
        unitCost: null,
      });
      expect(modal.showAddVariant()).toBe(false);
      expect(modal.addVariantSaving()).toBe(false);
    });

    it('prefiere el sizeOrder del POST y hereda el costo único', () => {
      createdResponse = [
        { productVariantId: 'v3', sku: 'SKU-3', size: '43', colorName: 'Azul', sizeOrder: 4 },
      ];
      const modal = setup();
      modal.onProductSelected(fakeProduct);
      modal.onUniqueCostChange('45');

      modal.onSaveAddVariant(newDto);

      const rows = modal.itemModel().variants;
      expect(rows.map((v) => v.sku)).toEqual(['SKU-1', 'SKU-3', 'SKU-2']);
      expect(rows[1].unitCost).toBe(45);
    });

    it('sin respuesta del backend muestra error y no agrega filas', () => {
      createdResponse = [];
      const modal = setup();
      modal.onProductSelected(fakeProduct);

      modal.onSaveAddVariant(newDto);

      expect(modal.itemModel().variants).toHaveLength(2);
      expect(modal.error()).toBe('El backend no devolvió la variante creada.');
    });
  });

  describe('agrupado por color', () => {
    const mixed: ProductSearchResult = {
      ...fakeProduct,
      productVariants: [
        { id: 'v1', sku: 'SKU-1', size: '42', sizeId: 's42', sizeOrder: 3, colorId: 'c-azul', colorName: 'Azul', price: 100 },
        { id: 'v3', sku: 'SKU-3', size: '43', sizeId: 's43', sizeOrder: 4, colorId: 'c-azul', colorName: 'Azul', price: 100 },
        { id: 'v2', sku: 'SKU-2', size: '44', sizeId: 's44', sizeOrder: 5, colorId: 'c-rojo', colorName: 'Rojo', price: 100 },
      ],
    };

    it('agrupa por color preservando orden e índices planos', () => {
      const modal = setup();
      modal.onProductSelected(mixed);

      const groups = modal.rowsByColor();
      expect(groups.map((g) => g.colorName)).toEqual(['Azul', 'Rojo']);
      expect(groups[0].rows.map((r) => r.variant.sku)).toEqual(['SKU-1', 'SKU-3']);
      expect(groups[0].rows.map((r) => r.index)).toEqual([0, 1]);
      expect(groups[1].rows.map((r) => r.index)).toEqual([2]);
    });

    it('el índice plano edita la fila correcta y suma unidades por grupo', () => {
      const modal = setup();
      modal.onProductSelected(mixed);

      modal.updateVariantField(2, 'quantityReceived', fieldEvent('5'));

      expect(modal.itemModel().variants[2].quantityReceived).toBe(5);
      expect(modal.itemModel().variants[0].quantityReceived).toBeNull();
      expect(modal.rowsByColor()[1].units).toBe(5);
      expect(modal.rowsByColor()[0].units).toBe(0);
    });
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

      const header = (root.textContent ?? '').replace(/\s+/g, ' ');
      expect(header).toContain('Nike');
      expect(header).toContain('Zapato');
      expect(header.indexOf('Nike')).toBeLessThan(header.indexOf('Zapato'));
      expect(header).toContain('2 tallas');
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
