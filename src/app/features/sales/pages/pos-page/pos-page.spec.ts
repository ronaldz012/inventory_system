import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import PosPage from './pos-page';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { SaleService } from '@features/sales/services/sale-service';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ProductService } from '@features/inventory/services/product-service';

describe('PosPage — modal de búsqueda en la URL', () => {
  let params$: BehaviorSubject<ParamMap>;
  let calls: { commands: unknown[]; extras: Record<string, unknown> }[];

  const setParams = (raw: Record<string, string>) => {
    params$.next(convertToParamMap(raw));
  };

  beforeEach(async () => {
    params$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    calls = [];

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
        { provide: SaleService, useValue: {} },
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

  it('arranca con el modal cerrado', () => {
    const { page } = setup();
    expect(page.isSearchOpen()).toBe(false);
  });

  it('openSearch empuja ?modal=search (el "atrás" lo cierra)', () => {
    const { page } = setup();
    calls = [];
    page.openSearch();

    expect(calls).toHaveLength(1);
    expect(calls[0].extras['queryParams']).toEqual({ modal: 'search' });
    expect(calls[0].extras['queryParamsHandling']).toBe('merge');
    expect(calls[0].extras['replaceUrl']).toBeUndefined();
  });

  it('?modal=search abre el modal', () => {
    setup();
    setParams({ modal: 'search' });
    const second = TestBed.createComponent(PosPage);
    second.detectChanges();
    const reopened = second.componentInstance;
    expect(reopened.isSearchOpen()).toBe(true);
    expect(second.nativeElement.querySelector('app-pos-search-modal')).not.toBeNull();
  });

  it('closeSearch limpia el param conservando el resto', () => {
    const { page } = setup();
    calls = [];
    page.closeSearch();

    expect(calls).toHaveLength(1);
    expect(calls[0].extras['queryParams']).toEqual({ modal: null });
    expect(calls[0].extras['replaceUrl']).toBe(true);
  });
});
