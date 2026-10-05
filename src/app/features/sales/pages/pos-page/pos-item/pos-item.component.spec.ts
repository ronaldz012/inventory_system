import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { applyEach, form, min } from '@angular/forms/signals';
import { PosCartItemCardComponent } from './pos-item.component';
import { PosCartItem, PosSaleState } from '@features/sales/models/pos-sale-state.model';

const testItem: PosCartItem = {
  productVariantId: 'v1',
  productName: 'Semiclásico',
  quantity: 2,
  categoryName: 'Pantalones',
  brandName: 'Levis',
  sku: 'LEV1-042',
  size: '42',
  colorName: 'Azul',
  stock: 7,
  originalPrice: 250,
  sellingPrice: 240,
  discountAmount: 10,
};

const baseModel = (): PosSaleState => ({
  paymentMethod: null,
  transactionCode: null,
  publicName: '',
  cashReceived: 0,
  items: [{ ...testItem }],
});

@Component({
  standalone: true,
  imports: [PosCartItemCardComponent],
  template: `<app-pos-cart-item-card [item]="tree" (removed)="onRemoved()" />`,
})
class Host {
  model = signal<PosSaleState>(baseModel());
  cartForm = form(this.model, (schemaPath) => {
    applyEach(schemaPath.items, (item) => {
      min(item.quantity, 1, { message: 'Mínimo 1 unidad.' });
    });
  });
  tree = this.cartForm.items[0];
  removed = 0;
  onRemoved(): void {
    this.removed++;
  }
}

describe('PosCartItemCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  });

  function setup(): { fixture: ComponentFixture<Host>; host: Host } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, host: fixture.componentInstance };
  }

  const root = (f: ComponentFixture<Host>): HTMLElement => f.nativeElement as HTMLElement;

  it('pinta marca, nombre, variante, precio, cantidad y subtotal', () => {
    const { fixture } = setup();
    const text = (root(fixture).textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('Levis');
    expect(text).toContain('Semiclásico');
    expect(text).toContain('LEV1-042');
    expect(text).toContain('Azul');
    expect(text).toContain('42');
    expect(text).toContain('480.00'); // subtotal 240 x 2

    // los inputs no aportan textContent: se leen por value
    const price = root(fixture).querySelector<HTMLInputElement>(
      'input[aria-label="Precio de venta"]',
    )!;
    const qty = root(fixture).querySelector<HTMLInputElement>('input[aria-label="Cantidad"]')!;
    expect(price.value).toBe('240');
    expect(qty.value).toBe('2');
  });

  it('"Eliminar" emite removed', () => {
    const { fixture, host } = setup();
    const remove = Array.from(root(fixture).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Eliminar',
    )!;
    remove.click();
    expect(host.removed).toBe(1);
  });

  it('el + de cantidad se deshabilita al llegar al stock', () => {
    const { fixture, host } = setup();
    host.tree.quantity().value.set(7);
    fixture.detectChanges();

    const plus = root(fixture).querySelector<HTMLButtonElement>('[aria-label="Agregar uno"]')!;
    expect(plus.disabled).toBe(true);
  });

  it('cantidad y precio ocultan los spinners nativos (usan steppers propios)', () => {
    const { fixture } = setup();
    const qty = root(fixture).querySelector<HTMLElement>('input[aria-label="Cantidad"]')!;
    const price = root(fixture).querySelector<HTMLElement>('input[aria-label="Precio de venta"]')!;

    for (const el of [qty, price]) {
      expect(el.className).toContain('[appearance:textfield]');
      expect(el.className).toContain('[&::-webkit-inner-spin-button]:appearance-none');
      expect(el.className).toContain('[&::-webkit-outer-spin-button]:appearance-none');
    }
  });
});
