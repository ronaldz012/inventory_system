import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProductFilterBar } from './product-filter-bar';
import { ProductQueryParams, ProductSortBy } from '../../../dtos/products/product-dto';
import { Gender } from '../../../interfaces/gender';
import { CategoryService } from '../../../services/category-service';
import { BrandService } from '@features/inventory/services/brand-service';

@Component({
  standalone: true,
  imports: [ProductFilterBar],
  template: `<app-product-filter-bar
    [params]="params()"
    (change)="patch($event)"
    (clear)="cleared.set(true)"
  />`,
})
class Host {
  params = signal<ProductQueryParams>({ page: 1, pageSize: 10 });
  patches: Partial<ProductQueryParams>[] = [];
  cleared = signal(false);

  patch(p: Partial<ProductQueryParams>): void {
    this.patches.push(p);
    this.params.update((q) => ({ ...q, ...p }));
  }
}

describe('ProductFilterBar', () => {
  const categories = signal([{ id: 'c1', name: 'Calzado' }]);
  const brands = signal([{ id: 'b1', name: 'Nike' }]);

  beforeEach(async () => {
    categories.set([{ id: 'c1', name: 'Calzado' }]);
    brands.set([{ id: 'b1', name: 'Nike' }]);
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: CategoryService, useValue: { categories, load: () => {} } },
        { provide: BrandService, useValue: { brands, load: () => {} } },
      ],
    }).compileComponents();
  });

  function setup(): { fixture: ComponentFixture<Host>; host: Host; bar: ProductFilterBar } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = fixture.componentInstance;
    const bar = fixture.debugElement.query(By.directive(ProductFilterBar))
      .componentInstance as ProductFilterBar;
    return { fixture, host, bar };
  }

  const root = (f: ComponentFixture<Host>): HTMLElement => f.nativeElement as HTMLElement;
  const filtersBtn = (f: ComponentFixture<Host>): HTMLButtonElement =>
    root(f).querySelector<HTMLButtonElement>('[data-filters-menu] > button')!;
  const popover = (f: ComponentFixture<Host>): HTMLElement | null =>
    root(f).querySelector<HTMLElement>('[role="dialog"]');
  const chips = (f: ComponentFixture<Host>): HTMLButtonElement[] =>
    Array.from(root(f).querySelectorAll<HTMLButtonElement>('[aria-label^="Quitar filtro"]'));

  it('el buscador menciona marca y no hay select de marca', () => {
    const { fixture } = setup();
    const input = root(fixture).querySelector('input')!;
    expect(input.placeholder).toContain('marca');
    expect(root(fixture).textContent).not.toContain('Todas las marcas');
  });

  it('el popover de filtros arranca cerrado y abre con el badge de filtros', () => {
    const { fixture } = setup();
    expect(popover(fixture)).toBeNull();
    filtersBtn(fixture).click();
    fixture.detectChanges();
    expect(popover(fixture)).not.toBeNull();
    expect(filtersBtn(fixture).getAttribute('aria-expanded')).toBe('true');
  });

  it('click fuera cierra el popover', () => {
    const { fixture } = setup();
    filtersBtn(fixture).click();
    fixture.detectChanges();
    root(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(popover(fixture)).toBeNull();
  });

  it('Escape cierra el popover', () => {
    const { fixture } = setup();
    filtersBtn(fixture).click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(popover(fixture)).toBeNull();
  });

  it('sin filtros no hay chips ni badge', () => {
    const { fixture } = setup();
    expect(chips(fixture)).toHaveLength(0);
    expect(root(fixture).textContent).not.toContain('Limpiar');
  });

  it('categoría activa muestra un chip con el nombre y se quita al pulsarlo', () => {
    const { fixture, host } = setup();
    host.params.set({ page: 1, pageSize: 10, categoryId: 'c1' });
    fixture.detectChanges();

    const chip = chips(fixture)[0];
    expect(chip.textContent).toContain('Categoría: Calzado');
    expect(root(fixture).textContent).toContain('Filtros');

    chip.click();
    fixture.detectChanges();
    expect(host.patches.at(-1)).toEqual({ categoryId: undefined, page: 1 });
    expect(chips(fixture)).toHaveLength(0);
  });

  it('el chip de género usa la etiqueta correcta y contempla Unisex (0)', () => {
    const { fixture, host } = setup();
    host.params.set({ page: 1, pageSize: 10, gender: Gender.Unisex });
    fixture.detectChanges();
    expect(chips(fixture)[0].textContent).toContain('Género: Unisex');

    host.params.set({ page: 1, pageSize: 10, gender: Gender.Mujer });
    fixture.detectChanges();
    expect(chips(fixture)[0].textContent).toContain('Género: Mujer');
  });

  it('el toggle de inactivos dentro del popover emite includeInactive', () => {
    const { fixture, host } = setup();
    filtersBtn(fixture).click();
    fixture.detectChanges();

    const toggle = root(fixture).querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(host.patches.at(-1)).toEqual({ includeInactive: true, page: 1 });

    toggle.click();
    fixture.detectChanges();
    expect(host.patches.at(-1)).toEqual({ includeInactive: undefined, page: 1 });
  });

  it('el género se emite como número y vacío como undefined', () => {
    const { fixture, host } = setup();
    filtersBtn(fixture).click();
    fixture.detectChanges();

    const gender = root(fixture).querySelector<HTMLSelectElement>('#filtro-genero')!;
    gender.value = String(Gender.Hombre);
    gender.dispatchEvent(new Event('change'));
    expect(host.patches.at(-1)).toEqual({ gender: Gender.Hombre, page: 1 });

    gender.value = '';
    gender.dispatchEvent(new Event('change'));
    expect(host.patches.at(-1)).toEqual({ gender: undefined, page: 1 });
  });

  it('Enter aplica la búsqueda al instante y baja el teclado', () => {
    vi.useFakeTimers();
    try {
      const { fixture, host } = setup();
      const input = root(fixture).querySelector<HTMLInputElement>('input')!;
      input.focus();
      input.value = 'nike';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      // sin esperar el debounce
      expect(host.patches.at(-1)).toEqual({ filter: 'nike', page: 1 });
      expect(document.activeElement).not.toBe(input);
    } finally {
      vi.useRealTimers();
    }
  });

  it('el input declara enterkeyhint=search', () => {
    const { fixture } = setup();
    expect(root(fixture).querySelector('input')!.getAttribute('enterkeyhint')).toBe('search');
  });

  it('Limpiar filtros emite el evento clear y cierra el popover', () => {
    const { fixture, host, bar } = setup();
    host.params.set({ page: 1, pageSize: 10, categoryId: 'c1' });
    fixture.detectChanges();
    filtersBtn(fixture).click();
    fixture.detectChanges();

    // "Limpiar filtros" es el único button hijo directo del popover
    root(fixture).querySelector<HTMLButtonElement>('[role="dialog"] > button')!.click();
    fixture.detectChanges();

    expect(host.cleared()).toBe(true);
    expect(bar.filtersOpen()).toBe(false);
  });

  describe('menú de orden', () => {
    const sortBtn = (f: ComponentFixture<Host>): HTMLButtonElement =>
      root(f).querySelector<HTMLButtonElement>('[data-sort-menu] > button')!;
    const sortMenu = (f: ComponentFixture<Host>): HTMLElement | null =>
      root(f).querySelector<HTMLElement>('[data-sort-menu] [role="menu"]');
    const sortItems = (f: ComponentFixture<Host>): HTMLButtonElement[] =>
      Array.from(
        root(f).querySelectorAll<HTMLButtonElement>('[data-sort-menu] [role="menuitemradio"]'),
      );
    const sortLabel = (el: HTMLElement) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').replace('check ', '').trim();

    it('arranca cerrado, con "Ordenar" y sin orden activo', () => {
      const { fixture, bar } = setup();
      expect(sortMenu(fixture)).toBeNull();
      expect(bar.sortActive()).toBe(false);
      expect(sortBtn(fixture).textContent).toContain('Ordenar');
      expect(sortBtn(fixture).getAttribute('aria-expanded')).toBe('false');
    });

    it('abre con 3 opciones y marca la activa', () => {
      const { fixture } = setup();
      sortBtn(fixture).click();
      fixture.detectChanges();

      expect(sortMenu(fixture)).not.toBeNull();
      expect(sortBtn(fixture).getAttribute('aria-expanded')).toBe('true');
      const items = sortItems(fixture);
      expect(items.map(sortLabel)).toEqual(['Más recientes', 'Mayor stock', 'Menor stock']);
      expect(items.map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    });

    it('elegir "Mayor stock" emite el sort, cierra el menú y marca el botón', () => {
      const { fixture, host, bar } = setup();
      sortBtn(fixture).click();
      fixture.detectChanges();
      sortItems(fixture)[1].click();
      fixture.detectChanges();

      expect(host.patches.at(-1)).toEqual({
        sortBy: ProductSortBy.Stock,
        sortDescending: true,
        page: 1,
      });
      expect(sortMenu(fixture)).toBeNull();
      expect(bar.sortActive()).toBe(true);
      expect(sortBtn(fixture).textContent).toContain('Mayor stock');
    });

    it('"Menos stock" invierte la dirección', () => {
      const { fixture, host } = setup();
      sortBtn(fixture).click();
      fixture.detectChanges();
      sortItems(fixture)[2].click();
      fixture.detectChanges();

      expect(host.patches.at(-1)).toEqual({
        sortBy: ProductSortBy.Stock,
        sortDescending: false,
        page: 1,
      });
    });

    it('volver a "Más recientes" deja el botón neutro', () => {
      const { fixture, host, bar } = setup();
      sortBtn(fixture).click();
      fixture.detectChanges();
      sortItems(fixture)[1].click();
      fixture.detectChanges();
      sortBtn(fixture).click();
      fixture.detectChanges();
      sortItems(fixture)[0].click();
      fixture.detectChanges();

      expect(host.patches.at(-1)).toEqual({
        sortBy: ProductSortBy.CreatedAt,
        sortDescending: true,
        page: 1,
      });
      expect(bar.sortActive()).toBe(false);
      expect(sortBtn(fixture).textContent).toContain('Ordenar');
    });

    it('Escape cierra el menú de orden', () => {
      const { fixture } = setup();
      sortBtn(fixture).click();
      fixture.detectChanges();
      sortMenu(fixture)!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();
      expect(sortMenu(fixture)).toBeNull();
    });

    it('click fuera cierra el menú de orden', () => {
      const { fixture } = setup();
      sortBtn(fixture).click();
      fixture.detectChanges();
      root(fixture).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(sortMenu(fixture)).toBeNull();
    });

    it('el orden no cuenta como filtro (no genera chip ni sube el badge)', () => {
      const { fixture, host } = setup();
      sortBtn(fixture).click();
      fixture.detectChanges();
      sortItems(fixture)[1].click();
      fixture.detectChanges();

      expect(chips(fixture)).toHaveLength(0);
      expect(filtersBtn(fixture).textContent).not.toContain('1');
    });
  });
});
