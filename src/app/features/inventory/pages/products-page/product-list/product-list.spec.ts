import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import ProductList from './product-list';
import { ProductService } from '../../../services/product-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ToastService } from '@core/services/toast-service';
import { ModalStackService } from '@core/modal-stack-service';
import { CategoryService } from '../../../services/category-service';
import { ListProductDto } from '../../../dtos/products/list-product-dto';
import { ProductDetailDto } from '../../../dtos/products/product-detail-dto';
import { Gender } from '../../../interfaces/gender';
import { ProductSortBy } from '../../../dtos/products/product-dto';

interface NavigateCall {
  commands: unknown[];
  extras: Record<string, unknown>;
}

describe('ProductList — estado en la URL', () => {
  const items: ListProductDto[] = [
    {
      id: 'p1',
      name: 'Zapato',
      internalCode: 'ZAP',
      categoryName: 'Calzado',
      brandName: 'Nike',
      variantsCount: 3,
      totalStock: 10,
      basePrice: 100,
      isActive: true,
      minPrice: 100,
      maxPrice: 150,
      colors: ['Negro', 'Oliva'],
    },
  ];

  let params$: BehaviorSubject<ParamMap>;
  let calls: NavigateCall[];
  let requested: unknown[];
  let canCreate: boolean;
  let updateCalls: unknown[];
  let getByIdFail: boolean;
  let toastSuccess: unknown[];
  let toastErrors: unknown[];

  const detail: ProductDetailDto = {
    id: 'p1',
    name: 'Zapato',
    internalCode: 'ZAP',
    description: '',
    basePrice: 100,
    gender: Gender.Unisex,
    categoryId: 'c1',
    categoryName: 'Calzado',
    brandId: 'b1',
    brandName: 'Nike',
    totalAvailable: 10,
    isActive: true,
    variants: [],
  };

  const setParams = (raw: Record<string, string>) => {
    params$.next(convertToParamMap(raw));
  };

  const lastCall = (): NavigateCall => calls[calls.length - 1];
  const lastQueryParams = (): Record<string, unknown> =>
    lastCall().extras['queryParams'] as Record<string, unknown>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    calls = [];
    requested = [];
    canCreate = true;
    updateCalls = [];
    getByIdFail = false;
    toastSuccess = [];
    toastErrors = [];

    await TestBed.configureTestingModule({
      imports: [ProductList],
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
          provide: ProductService,
          useValue: {
            getProducts: (q: unknown) => {
              requested.push(q);
              return {
                subscribe: ({ next }: { next: (d: unknown) => void }) =>
                  next({ items, totalCount: 1, page: 1, pageSize: 10, totalPages: 1 }),
              };
            },
            getById: () => ({
              subscribe: ({
                next,
                error,
              }: {
                next: (d: unknown) => void;
                error: (e: unknown) => void;
              }) => (getByIdFail ? error({ message: 'Falla' }) : next(detail)),
            }),
            update: (id: unknown, dto: unknown) => {
              updateCalls.push({ id, dto });
              return { subscribe: ({ next }: { next: () => void }) => next() };
            },
          },
        },
        { provide: PermissionService, useValue: { canCreate: () => canCreate, can: () => true } },
        {
          provide: ToastService,
          useValue: {
            success: (m: unknown) => void toastSuccess.push(m),
            error: (m: unknown) => void toastErrors.push(m),
          },
        },
        { provide: CategoryService, useValue: { load: () => {}, categories: signal([]) } },
      ],
    }).compileComponents();
  });

  function setup(): { fixture: ComponentFixture<ProductList>; list: ProductList } {
    const fixture = TestBed.createComponent(ProductList);
    const list = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, list };
  }

  describe('lectura', () => {
    it('sin params usa los defaults', () => {
      const { list } = setup();
      expect(list.query().page).toBe(1);
      expect(list.query().pageSize).toBe(10);
      expect(list.query().filter).toBeUndefined();
    });

    it('restaura los filtros desde la URL (refresh / "atrás")', () => {
      setParams({ filter: 'nike', categoryId: 'c1', gender: '0', page: '3', pageSize: '25' });
      const { list } = setup();
      expect(list.query()).toEqual({
        filter: 'nike',
        categoryId: 'c1',
        brandId: undefined,
        gender: Gender.Unisex,
        includeInactive: undefined,
        sortBy: ProductSortBy.CreatedAt,
        sortDescending: true,
        page: 3,
        pageSize: 25,
      });
      expect(list.hasActiveFilters()).toBe(true);
    });

    it('carga con los params de la URL apenas se inicializa', () => {
      setParams({ filter: 'nike' });
      setup();
      expect(requested.length).toBe(1);
      expect((requested[0] as { filter?: string }).filter).toBe('nike');
    });

    it('valores inválidos no rompen (caen al default)', () => {
      setParams({ page: 'abc', gender: '42' });
      const { list } = setup();
      expect(list.query().page).toBe(1);
      expect(list.query().gender).toBe(Gender.Unisex);
    });
  });

  describe('escritura', () => {
    it('patchQuery navega con merge + replaceUrl y omite defaults', () => {
      const { list } = setup();
      calls = [];

      list.patchQuery({ filter: 'nike', page: 1 });

      expect(calls.length).toBe(1);
      expect(lastCall().commands).toEqual([]);
      expect(lastCall().extras['queryParamsHandling']).toBe('merge');
      expect(lastCall().extras['replaceUrl']).toBe(true);
      // page=1 es el default → no se escribe
      expect(lastQueryParams()).toEqual({
        filter: 'nike',
        categoryId: undefined,
        brandId: undefined,
        gender: undefined,
        includeInactive: undefined,
        sortBy: undefined,
        sortDescending: undefined,
        page: undefined,
        pageSize: undefined,
      });
    });

    it('un cambio de página sí se escribe', () => {
      const { list } = setup();
      calls = [];
      list.patchQuery({ page: 4 });
      expect(lastQueryParams()['page']).toBe(4);
    });

    it('clearFilters deja la URL limpia', () => {
      const { list } = setup();
      calls = [];
      list.clearFilters();
      const query = lastQueryParams();
      expect(Object.values(query).every((v) => v === undefined)).toBe(true);
    });

    it('la URL manda: tras un patch, el estado se toma del queryParamMap', () => {
      const { fixture, list } = setup();
      calls = [];

      list.patchQuery({ filter: 'nike' });
      // el router emite la nueva URL
      setParams({ filter: 'nike', page: '1' });
      fixture.detectChanges();

      expect(list.query().filter).toBe('nike');
      expect(requested.length).toBe(2);
    });

    it('abrir/cerrar el modal NO vuelve a pedir productos', () => {
      const { list } = setup();
      expect(requested.length).toBe(1);
      list.openCreateModal();
      expect(list.showCreateModal()).toBe(true);
      expect(requested.length).toBe(1);
      list.closeCreateModal();
      expect(list.showCreateModal()).toBe(false);
      expect(requested.length).toBe(1);
    });
  });

  describe('modales por signals', () => {
    it('openCreateModal/closeCreateModal no tocan la URL', () => {
      const { list } = setup();
      calls = [];
      list.openCreateModal();
      expect(list.showCreateModal()).toBe(true);
      expect(calls).toEqual([]);
      list.closeCreateModal();
      expect(list.showCreateModal()).toBe(false);
      expect(calls).toEqual([]);
    });

    it('goToEdit trae el detalle y abre el panel in-place registrado en la pila', () => {
      const { list } = setup();
      const stack = TestBed.inject(ModalStackService);
      calls = [];
      list.goToEdit('p1');
      expect(list.editingProduct()?.id).toBe('p1');
      expect(stack.isEmpty()).toBe(false);
      expect(calls).toEqual([]);
    });

    it('goToEdit con error no abre y avisa con toast', () => {
      getByIdFail = true;
      const { list } = setup();
      list.goToEdit('p1');
      expect(list.editingProduct()).toBeNull();
      expect(toastErrors.length).toBe(1);
    });

    it('onEditSave actualiza, cierra, avisa y recarga la lista', () => {
      const { list } = setup();
      list.goToEdit('p1');
      const before = requested.length;
      list.onEditSave({ name: 'Zapato X' } as never);
      expect(updateCalls.length).toBe(1);
      expect(list.editingProduct()).toBeNull();
      expect(list.editSubmitting()).toBe(false);
      expect(toastSuccess.length).toBe(1);
      expect(requested.length).toBe(before + 1);
    });

    it('closeTop con edición abierta la cierra sin navegar', () => {
      const { list } = setup();
      const stack = TestBed.inject(ModalStackService);
      calls = [];
      list.goToEdit('p1');
      expect(stack.closeTop()).toBe(true);
      expect(list.editingProduct()).toBeNull();
      expect(calls).toEqual([]);
    });

    it('el botón "Nuevo producto" se muestra con permiso create', () => {
      const { fixture } = setup();
      expect(fixture.nativeElement.textContent).toContain('Nuevo producto');
    });

    it('sin permiso create el botón no aparece', () => {
      canCreate = false;
      const { fixture } = setup();
      expect(fixture.nativeElement.textContent).not.toContain('Nuevo producto');
    });
  });
});
