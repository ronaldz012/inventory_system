import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import CreateTransfer from './create-transfer';
import { TransferService } from '../../../services/transfer-service';
import { ProductService } from '@features/inventory/services/product-service';
import { BranchContextService } from '@core/services/branch-context-service';
import { ToastService } from '@core/services/toast-service';

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
              return of(void 0);
            },
          },
        },
        { provide: ProductService, useValue: {} },
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
        variantId: 'v1', sku: 'SKU-1', productName: 'Zapato', brandName: 'Nike',
        variantLabel: 'Talle 35 · Rojo', size: '35', colorName: 'Rojo',
        quantity: 2, maxQuantity: 5,
      },
    ]);
    return { fixture, page };
  }

  it('submit abre el confirm vía URL sin llamar al backend', () => {
    const { page } = setup();
    page.submit();
    expect(navigateSpy.calls).toContain('confirm');
    expect(page.showConfirm()).toBe(true);
    expect(createSpy.calls).toBe(0);
  });

  it('closeConfirm consume con back() sin duplicar', () => {
    const { page } = setup();
    page.submit();
    page.closeConfirm();
    expect(backSpy.calls).toBe(1);
    expect(navigateSpy.calls).not.toContain(null);
    params$.next({ get: () => null });
    expect(page.showConfirm()).toBe(false);
  });

  it('executeCreate envía el payload y navega a transfers', () => {
    const { page } = setup();
    page.executeCreate();
    expect(createSpy.calls).toBe(1);
    expect(navigateSpy.calls).toContainEqual(['inventory', 'transfers']);
    const payload = createSpy.payload as { toBranchId: string; items: { productVariantId: string; quantityRequested: number }[] };
    expect(payload.toBranchId).toBe('b2');
    expect(payload.items).toEqual([{ productVariantId: 'v1', quantityRequested: 2 }]);
  });

  it('sin destino no abre el confirm', () => {
    const { page } = setup();
    page.form.set({ toBranchId: null, notes: '', items: [] });
    page.submit();
    expect(page.showConfirm()).toBe(false);
    expect(createSpy.calls).toBe(0);
  });
});
