import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import ProductList from './product-list';
import { ProductService } from '../../../services/product-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ListProductDto } from '../../../dtos/products/list-product-dto';
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
    },
  ];

  let params$: BehaviorSubject<ParamMap>;
  let calls: NavigateCall[];
  let requested: unknown[];
  let canCreate: boolean;

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
          },
        },
        { provide: PermissionService, useValue: { canCreate: () => canCreate } },
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
      const { fixture, list } = setup();
      expect(requested.length).toBe(1);

      setParams({ modal: 'create' });
      fixture.detectChanges();
      expect(list.showCreateModal()).toBe(true);
      expect(requested.length).toBe(1);

      setParams({});
      fixture.detectChanges();
      expect(list.showCreateModal()).toBe(false);
      expect(requested.length).toBe(1);
    });
  });

  describe('modal de crear producto (?modal=create)', () => {
    it('openCreateModal empuja la entrada con modal=create', () => {
      const { list } = setup();
      calls = [];
      list.openCreateModal();
      expect(lastCall().extras['queryParams']).toEqual({ modal: 'create' });
      expect(lastCall().extras['queryParamsHandling']).toBe('merge');
      // abrir un modal SÍ crea entrada: tiene que poder cerrarse con "atrás"
      expect(lastCall().extras['replaceUrl']).toBeUndefined();
    });

    it('closeCreateModal limpia el param conservando los filtros', () => {
      const { list } = setup();
      calls = [];
      list.closeCreateModal();
      expect(lastCall().extras['queryParams']).toEqual({ modal: null });
      expect(lastCall().extras['replaceUrl']).toBe(true);
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
