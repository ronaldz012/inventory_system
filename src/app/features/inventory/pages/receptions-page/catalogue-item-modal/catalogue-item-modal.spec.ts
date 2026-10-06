import { TestBed } from '@angular/core/testing';
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
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogueItemModal],
      // modo add: no hace HTTP (solo initFromEdit llamaría a getById)
      providers: [{ provide: ProductService, useValue: {} }],
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
});
