import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PosSearchModal } from './pos-search-modal';
import { ProductService } from '@features/inventory/services/product-service';
import { ProductVariantSearchDto } from '@features/inventory/dtos/products/product-variant-search-dto';
import { Gender } from '@features/inventory/interfaces/gender';

const variants: ProductVariantSearchDto[] = [
  {
    id: 'v1',
    sku: 'LEV1-038',
    productId: 'p1',
    productName: 'Semiclásico',
    brandName: 'Levis',
    categoryName: 'Pantalones',
    gender: Gender.Hombre,
    colorId: 'c-azul',
    colorName: 'Azul',
    sizeId: 's-42',
    size: '42',
    price: 250,
    availableStockInBranch: 7,
  },
  {
    id: 'v2',
    sku: 'LEV1-044',
    productId: 'p1',
    productName: 'Semiclásico',
    brandName: 'Levis',
    categoryName: 'Pantalones',
    gender: Gender.Hombre,
    colorId: 'c-azul',
    colorName: 'Azul',
    sizeId: 's-44',
    size: '44',
    price: 250,
    availableStockInBranch: 0,
  },
];

describe('PosSearchModal', () => {
  let requested: string[];

  beforeEach(async () => {
    requested = [];
    await TestBed.configureTestingModule({
      imports: [PosSearchModal],
      providers: [
        {
          provide: ProductService,
          useValue: {
            searchVariants: (q: string) => {
              requested.push(q);
              return of(variants);
            },
          },
        },
      ],
    }).compileComponents();
  });

  function setup(): { fixture: ComponentFixture<PosSearchModal>; modal: PosSearchModal } {
    const fixture = TestBed.createComponent(PosSearchModal);
    const modal = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, modal };
  }

  const root = (f: ComponentFixture<PosSearchModal>): HTMLElement => f.nativeElement as HTMLElement;
  const input = (f: ComponentFixture<PosSearchModal>): HTMLInputElement =>
    root(f).querySelector('input')!;
  const rows = (f: ComponentFixture<PosSearchModal>): HTMLButtonElement[] =>
    Array.from(root(f).querySelectorAll<HTMLButtonElement>('ul button'));

  function type(fixture: ComponentFixture<PosSearchModal>, text: string): void {
    vi.useFakeTimers();
    try {
      const el = input(fixture);
      el.value = text;
      el.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(400);
      fixture.detectChanges();
    } finally {
      vi.useRealTimers();
    }
  }

  it('enfoca el buscador al abrir el modal', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const el = input(fixture);
    expect(document.activeElement).toBe(el);
  });

  it('con menos de 2 caracteres no busca y muestra la ayuda', () => {
    const { fixture } = setup();
    type(fixture, 'a');
    expect(requested).toHaveLength(0);
    expect(root(fixture).textContent).toContain('al menos 2 caracteres');
  });

  it('busca con debounce y pinta marca, nombre, precio y stock', () => {
    const { fixture } = setup();
    type(fixture, 'levi');
    expect(requested).toEqual(['levi']);

    const items = rows(fixture);
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Levis');
    expect(items[0].textContent).toContain('Semiclásico');
    expect(items[0].textContent).toContain('7u');
  });

  it('Enter baja el teclado sin cambiar la búsqueda', () => {
    const { fixture } = setup();
    type(fixture, 'levi');
    const el = input(fixture);
    el.focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(document.activeElement).not.toBe(el);
    expect(el.value).toBe('levi');
    expect(el.getAttribute('enterkeyhint')).toBe('search');
  });

  it('la variante sin stock no es seleccionable', () => {
    const { fixture } = setup();
    type(fixture, 'levi');

    const items = rows(fixture);
    expect(items[0].disabled).toBe(false);
    expect(items[1].disabled).toBe(true);
    expect(items[1].textContent).toContain('0u');
  });

  it('elegir una variante emite su SKU', () => {
    const { fixture, modal } = setup();
    const emitted: string[] = [];
    modal.variantSelected.subscribe((sku) => emitted.push(sku));
    type(fixture, 'levi');

    rows(fixture)[0].click();
    expect(emitted).toEqual(['LEV1-038']);
  });
});
