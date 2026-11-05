import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ClosureSaleItemDto } from '@features/sales/dtos/closure-detail-dto';
import {
  DocumentType,
  PaymentMethod,
  SaleReturnStatus,
  SaleType,
} from '@features/sales/dtos/sale-detail-dto';
import { PermissionService } from '@features/auth/services/permmision-service';
import { CloseSaleItem } from './close-sale-item';

const saleItems = [
  {
    productVariantId: 'var-1',
    productSku: 'NIK1-001',
    productDisplayName: 'Nike Zapatillas Air Max 90 - Negro / 42',
    quantity: 2,
    unitPrice: 120,
    unitCost: 0,
    discountAmount: 5,
    finalPrice: 230,
  },
  {
    productVariantId: 'var-2',
    productSku: 'NIK3-001',
    productDisplayName: 'Nike Chaqueta Albha - Azul / 35',
    quantity: 1,
    unitPrice: 120,
    unitCost: 0,
    discountAmount: 0,
    finalPrice: 120,
  },
];

const baseSale = (overrides: Partial<ClosureSaleItemDto> = {}): ClosureSaleItemDto => ({
  id: 'sale-1',
  number: 33,
  createdAt: '2026-10-05T04:50:53.831699Z',
  soldByName: 'Admin Admin',
  totalAmount: 350,
  paymentMethod: PaymentMethod.QrCode,
  documentType: DocumentType.Ticket,
  type: SaleType.Sale,
  originalSaleId: null,
  originalSaleNumber: null,
  invoiceNumber: null,
  transactionCode: null,
  itemsCount: 3,
  hasReturn: false,
  returnStatus: SaleReturnStatus.None,
  canReturn: true,
  cantReturnReason: null,
  items: [],
  ...overrides,
});

@Component({
  imports: [CloseSaleItem],
  template: `<ul>
    <li app-close-sale-item [sale]="sale()"></li>
  </ul>`,
})
class Host {
  sale = signal(baseSale());
}

describe('CloseSaleItem', () => {
  async function setup(): Promise<{
    fixture: ComponentFixture<Host>;
    host: Host;
    root: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [Host],
      // Sin contexto activo `canRead` daría false y el link a detalle no existe.
      providers: [
        provideRouter([]),
        { provide: PermissionService, useValue: { can: () => true, canRead: () => true } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, host: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  const text = (root: HTMLElement): string => (root.textContent ?? '').replace(/\s+/g, ' ');

  it('pinta número, monto, tipo, pago y cantidad', async () => {
    const { root } = await setup();

    expect(text(root)).toContain('#33');
    expect(text(root)).toContain('350.00');
    expect(text(root)).toContain('Venta');
    expect(text(root)).toContain('QR');
    expect(text(root)).toContain('3 art.');
  });

  it('marca las devoluciones como warning', async () => {
    const { fixture, host, root } = await setup();
    host.sale.set(
      baseSale({ number: 29, type: SaleType.Return, totalAmount: -100, itemsCount: -1 }),
    );
    fixture.detectChanges();

    expect(text(root)).toContain('Devolución');
    expect(text(root)).toContain('-100.00');
    expect(root.querySelector('.chip-warning')).not.toBeNull();
  });

  it('muestra "Devuelta" cuando la venta tiene devolución completa', async () => {
    const { fixture, host, root } = await setup();
    host.sale.set(baseSale({ number: 28, hasReturn: true, returnStatus: SaleReturnStatus.Full }));
    fixture.detectChanges();

    expect(text(root)).toContain('Devuelta');
    expect(text(root)).not.toContain('Parcial');
  });

  it('distingue la devolución parcial de la completa', async () => {
    const { fixture, host, root } = await setup();
    host.sale.set(
      baseSale({ number: 28, hasReturn: true, returnStatus: SaleReturnStatus.Partial }),
    );
    fixture.detectChanges();

    expect(text(root)).toContain('Parcial');
    expect(text(root)).not.toContain('Devuelta');
  });

  it('enlaza la devolución con su venta original y cuenta los artículos en positivo', async () => {
    const { fixture, host, root } = await setup();
    host.sale.set(
      baseSale({
        number: 29,
        type: SaleType.Return,
        totalAmount: -100,
        itemsCount: -2,
        originalSaleId: 'sale-28',
        originalSaleNumber: 28,
      }),
    );
    fixture.detectChanges();

    expect(text(root)).toContain('de #28');
    expect(text(root)).not.toContain('-2');
    expect(text(root)).toContain('2 art.');
  });

  it('muestra "Efectivo" para pagos en efectivo', async () => {
    const { fixture, host, root } = await setup();
    host.sale.set(baseSale({ number: 30, paymentMethod: PaymentMethod.Cash }));
    fixture.detectChanges();

    expect(text(root)).toContain('Efectivo');
    expect(text(root)).not.toContain('QR');
  });

  const occurrences = (haystack: string, needle: string): number =>
    haystack.split(needle).length - 1;

  it('lista los ítems siempre visibles, sin expandir (mobile y desktop)', async () => {
    const { fixture, host, root } = await setup();
    host.sale.set(baseSale({ items: saleItems }));
    fixture.detectChanges();

    // Sin click intermedio: los ítems ya están dos veces (mobile + desktop).
    expect(occurrences(text(root), 'Air Max 90')).toBe(2);
    expect(text(root)).toContain('230.00');
    expect(text(root)).toContain('120.00');
    expect(text(root)).toContain('NIK1-001');
    expect(root.querySelector('[title="Nike Zapatillas Air Max 90 - Negro / 42"]')).not.toBeNull();
    expect(root.querySelector('[title="NIK1-001"]')).not.toBeNull();

    // Ya no hay toggle: solo el ">" dummy de "ver detalle".
    expect(root.querySelector('button')).toBeNull();
    expect(root.querySelector('.material-icons')?.textContent?.trim()).toBe('chevron_right');
  });

  it('marca los ítems libres (sin SKU) como "Libre"', async () => {
    const { fixture, host, root } = await setup();
    host.sale.set(
      baseSale({
        items: [{ ...saleItems[0], productVariantId: null, productSku: '' }],
      }),
    );
    fixture.detectChanges();

    expect(text(root)).toContain('Libre');
    expect(root.querySelector('[title="Venta libre"]')).not.toBeNull();
  });
});
