import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import PosPage from './pos-page';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { SaleService } from '@features/sales/services/sale-service';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ProductService } from '@features/inventory/services/product-service';
import { CreateSaleDto } from '@features/sales/dtos/create-sale-dto';

describe('PosPage — modal de búsqueda (señal + pila de modales)', () => {
  let params$: BehaviorSubject<ParamMap>;
  let calls: { commands: unknown[]; extras: Record<string, unknown> }[];
  let capturedSale: CreateSaleDto | null;

  const setParams = (raw: Record<string, string>) => {
    params$.next(convertToParamMap(raw));
  };

  beforeEach(async () => {
    params$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    calls = [];
    capturedSale = null;

    await TestBed.configureTestingModule({
      imports: [PosPage],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: params$.asObservable() } },
        {
          provide: Router,
          useValue: {
            navigate: (commands: unknown[], extras: Record<string, unknown>) => {
              calls.push({ commands, extras });
              return Promise.resolve(true);
            },
          },
        },
        {
          provide: CashRegisterService,
          useValue: { getCurrentRegister: () => of({ isOpen: true }) },
        },
        {
          provide: SaleService,
          useValue: {
            createSale: (dto: CreateSaleDto) => {
              capturedSale = dto;
              return of(void 0);
            },
          },
        },
        {
          provide: ToastService,
          useValue: { success: () => {}, error: () => {}, warning: () => {} },
        },
        { provide: PermissionService, useValue: { can: () => true } },
        { provide: ProductService, useValue: {} },
      ],
    }).compileComponents();
  });

  function setup(): { fixture: ComponentFixture<PosPage>; page: PosPage } {
    const fixture = TestBed.createComponent(PosPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, page };
  }

  it('arranca con el buscador cerrado', () => {
    const { fixture, page } = setup();
    expect(page.searchOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-pos-search-modal')).toBeNull();
  });

  it('openSearch abre el buscador y lo registra en la pila de modales', () => {
    const { fixture, page } = setup();

    page.openSearch();
    fixture.detectChanges();

    expect(page.searchOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-pos-search-modal')).not.toBeNull();
  });

  it('closeSearch cierra el buscador', () => {
    const { fixture, page } = setup();

    page.openSearch();
    page.closeSearch();
    fixture.detectChanges();

    expect(page.searchOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-pos-search-modal')).toBeNull();
  });

  it('onFreeItemSaved agrega una línea libre al carrito', () => {
    const { page } = setup();
    page.onFreeItemSaved({ description: 'Pantalon diesel', quantity: 2, unitPrice: 45 });

    expect(page.posModel().items).toHaveLength(1);
    const item = page.posModel().items[0];
    expect(item.isFree).toBe(true);
    expect(item.productVariantId).toBeNull();
    expect(item.quantity).toBe(2);
    expect(item.originalPrice).toBe(45);
    expect(item.sellingPrice).toBe(45);
    expect(item.discountAmount).toBe(0);
  });

  it('submitSale envía libres y de catálogo con la forma dual del contrato', () => {
    const { page } = setup();
    page.posModel.set({
      paymentMethod: 0,
      transactionCode: null,
      publicName: '',
      cashReceived: 0,
      items: [
        {
          productVariantId: 'v1',
          quantity: 1,
          productName: 'Zapato',
          categoryName: '',
          brandName: '',
          sku: 'SKU-1',
          size: '42',
          colorName: 'Azul',
          stock: 5,
          originalPrice: 100,
          sellingPrice: 90,
          discountAmount: 10,
          isFree: false,
          description: null,
        },
        {
          productVariantId: null,
          quantity: 2,
          productName: '',
          categoryName: '',
          brandName: '',
          sku: '',
          size: '',
          colorName: '',
          stock: null,
          originalPrice: 40,
          sellingPrice: 45,
          discountAmount: -5,
          isFree: true,
          description: 'Pantalon libre',
        },
      ],
    });

    page.submitSale();

    expect(capturedSale).not.toBeNull();
    expect(capturedSale!.items).toEqual([
      { productVariantId: 'v1', quantity: 1, discountAmount: 10 },
      { description: 'Pantalon libre', unitPrice: 45, quantity: 2, discountAmount: 0 },
    ]);
  });

  it('venta libre con precio menor a Bs 0.50 invalida el formulario', () => {
    const { page } = setup();
    page.onFreeItemSaved({ description: 'Pantalon libre', quantity: 1, unitPrice: 45 });
    expect(page.posForm().valid()).toBe(true);

    page.posModel.update((state) => ({
      ...state,
      items: state.items.map((item) => ({ ...item, sellingPrice: 0.4 })),
    }));

    expect(page.posForm().valid()).toBe(false);
    expect(page.isFormValid()).toBe(false);
  });
});
