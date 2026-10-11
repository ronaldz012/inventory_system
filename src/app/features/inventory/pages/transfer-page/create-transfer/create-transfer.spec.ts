import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import CreateTransfer from './create-transfer';
import { TransferService } from '../../../services/transfer-service';
import { ProductService } from '@features/inventory/services/product-service';
import { BranchContextService } from '@core/services/branch-context-service';
import { ToastService } from '@core/services/toast-service';
import { ModalStackService } from '@core/modal-stack-service';

@Component({
  standalone: true,
  imports: [CreateTransfer],
  template: `<app-create-transfer />`,
})
class Host {}

describe('CreateTransfer confirm flow', () => {
  const createSpy = { calls: 0, payload: null as unknown };
  const params$ = new BehaviorSubject<{ get: (k: string) => string | null }>({
    get: () => null,
  });
  const navigateSpy = {
    calls: [] as unknown[],
    fn(commands: unknown[], extras?: { queryParams?: { modal?: string | null } }) {
      const modal = extras?.queryParams?.modal;
      if (extras?.queryParams) params$.next({ get: () => (modal == null ? null : modal) });
      this.calls.push(modal ?? commands);
      return Promise.resolve(true);
    },
  };
  const backSpy = { calls: 0 };
  const realBack = window.history.back.bind(window.history);

  beforeEach(async () => {
    createSpy.calls = 0;
    backSpy.calls = 0;
    navigateSpy.calls = [];
    params$.next({ get: () => null });
    window.history.back = () => {
      backSpy.calls++;
    };
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: params$.asObservable() } },
        { provide: Router, useValue: { navigate: (...a: unknown[]) => navigateSpy.fn(a[0] as unknown[], a[1] as never) } },
        {
          provide: TransferService,
          useValue: {
            createTransfer: (p: unknown) => {
              createSpy.calls++;
              createSpy.payload = p;
              return of('t1');
            },
          },
        },
        {
          provide: ProductService,
          useValue: {
            getVariantBySku: () =>
              of({
                id: 'v2',
                productId: 'p1',
                sku: 'SKU-2',
                productName: 'Zapato',
                brandName: 'Nike',
                displayName: 'Talle 36 · Azul',
                size: '36',
                colorName: 'Azul',
                availableStockInBranch: 5,
              }),
          },
        },
        {
          provide: BranchContextService,
          useValue: {
            active: signal({ branchId: 'b1', branchName: 'Sucursal A' }),
            getBranches: () => of([]),
          },
        },
        { provide: ToastService, useValue: { error: () => {}, success: () => {}, warning: () => {} } },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    window.history.back = realBack;
  });

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const page = fixture.debugElement.children[0].componentInstance as CreateTransfer;
    page.form.set({ toBranchId: 'b2', notes: '', items: [] });
    page.items.set([
      {
        variantId: 'v1', productId: 'p1', sku: 'SKU-1', productName: 'Zapato', brandName: 'Nike',
        variantLabel: 'Talle 35 · Rojo', size: '35', colorName: 'Rojo',
        quantity: 2, maxQuantity: 5,
      },
    ]);
    return { fixture, page };
  }

  it('submit abre el confirm por signal y lo registra en la pila', () => {
    const { page } = setup();
    const stack = TestBed.inject(ModalStackService);
    page.submit();
    expect(navigateSpy.calls).toEqual([]);
    expect(page.showConfirm()).toBe(true);
    expect(stack.isEmpty()).toBe(false);
    expect(createSpy.calls).toBe(0);
  });

  it('closeConfirm cierra por estado sin tocar el historial', () => {
    const { page } = setup();
    page.submit();
    expect(page.showConfirm()).toBe(true);
    page.closeConfirm();
    expect(page.showConfirm()).toBe(false);
    expect(backSpy.calls).toBe(0);
    expect(navigateSpy.calls).toEqual([]);
  });

  it('executeCreate envía el payload y navega al detalle creado', () => {
    const { page } = setup();
    page.executeCreate();
    expect(createSpy.calls).toBe(1);
    expect(navigateSpy.calls).toContainEqual(['inventory', 'transfers', 't1']);
    const payload = createSpy.payload as { toBranchId: string; items: { productVariantId: string; quantityRequested: number }[] };
    expect(payload.toBranchId).toBe('b2');
    expect(payload.items).toEqual([{ productVariantId: 'v1', quantityRequested: 2 }]);
  });

  it('agrega la variante nueva al inicio (prepend), no al fondo', () => {
    const { page } = setup();
    page.onSkuSubmit('SKU-2');
    expect(page.items().map((i) => i.variantId)).toEqual(['v2', 'v1']);
  });

  it('sin destino no abre el confirm', () => {
    const { page } = setup();
    page.form.set({ toBranchId: null, notes: '', items: [] });
    page.submit();
    expect(page.showConfirm()).toBe(false);
    expect(createSpy.calls).toBe(0);
  });
});
