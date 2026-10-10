import { TestBed } from '@angular/core/testing';
import { TransferRowSheet } from './transfer-row-sheet';

const baseItem = {
  variantId: 'v1',
  productId: 'p1',
  sku: 'SKU-1',
  productName: 'Zapato',
  brandName: 'Nike',
  variantLabel: 'Talle 42 · Azul',
  size: '42',
  colorName: 'Azul',
  quantity: 2,
  maxQuantity: 5,
};

describe('TransferRowSheet', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TransferRowSheet] }).compileComponents();
  });

  function setup(qty = 2) {
    const fixture = TestBed.createComponent(TransferRowSheet);
    fixture.componentRef.setInput('item', { ...baseItem, quantity: qty });
    fixture.detectChanges();
    return { sheet: fixture.componentInstance };
  }

  it('step dentro de [1, max] emite la nueva cantidad', () => {
    const { sheet } = setup();
    const saved: number[] = [];
    sheet.save.subscribe((q) => saved.push(q));

    sheet.step(1);
    sheet.step(-1);

    expect(saved).toEqual([3, 1]);
  });

  it('fuera de rango no emite', () => {
    const top = setup(5);
    const savedTop: number[] = [];
    top.sheet.save.subscribe((q) => savedTop.push(q));
    top.sheet.step(1);
    expect(savedTop).toEqual([]);

    const bottom = setup(1);
    const savedBottom: number[] = [];
    bottom.sheet.save.subscribe((q) => savedBottom.push(q));
    bottom.sheet.step(-1);
    expect(savedBottom).toEqual([]);
  });

  it('remove y close emiten', () => {
    const { sheet } = setup();
    let removed = 0;
    let closed = 0;
    sheet.remove.subscribe(() => removed++);
    sheet.close.subscribe(() => closed++);

    sheet.remove.emit();
    sheet.close.emit();

    expect(removed).toBe(1);
    expect(closed).toBe(1);
  });
});
