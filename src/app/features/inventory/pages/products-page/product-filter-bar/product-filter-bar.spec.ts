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

  describe('popover de filtros con botón Aplicar', () => {
    const openPopover = (f: ComponentFixture<Host>): void => {
      filtersBtn(f).click();
      f.detectChanges();
    };
    const applyBtn = (f: ComponentFixture<Host>): HTMLButtonElement =>
      root(f).querySelector<HTMLButtonElement>('[data-filters-apply]')!;
    const clearBtn = (f: ComponentFixture<Host>): HTMLButtonElement =>
      root(f).querySelector<HTMLButtonElement>('[data-filters-clear]')!;
    const category = (f: ComponentFixture<Host>): HTMLSelectElement =>
      root(f).querySelector<HTMLSelectElement>('#filtro-categoria')!;
    const gender = (f: ComponentFixture<Host>): HTMLSelectElement =>
      root(f).querySelector<HTMLSelectElement>('#filtro-genero')!;
    const inactive = (f: ComponentFixture<Host>): HTMLButtonElement =>
      root(f).querySelector<HTMLButtonElement>('[role="switch"]')!;

    it('cambiar un control NO emite nada (solo edita el borrador)', () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      host.patches.length = 0;

      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      gender(fixture).value = String(Gender.Hombre);
      gender(fixture).dispatchEvent(new Event('change'));
      inactive(fixture).click();
      fixture.detectChanges();

      expect(host.patches).toHaveLength(0);
    });

    it('"Aplicar" emite los tres campos juntos, en una sola llamada', () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      host.patches.length = 0;

      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      gender(fixture).value = String(Gender.Mujer);
      gender(fixture).dispatchEvent(new Event('change'));
      inactive(fixture).click();
      fixture.detectChanges();

      applyBtn(fixture).click();
      fixture.detectChanges();

      expect(host.patches).toEqual([
        { categoryId: 'c1', gender: Gender.Mujer, includeInactive: true, page: 1 },
      ]);
      expect(host.cleared()).toBe(false);
    });

    it('"Aplicar" cierra el popover', () => {
      const { fixture, bar } = setup();
      openPopover(fixture);
      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();
      applyBtn(fixture).click();
      fixture.detectChanges();
      expect(bar.filtersOpen()).toBe(false);
    });

    it('"Aplicar" empieza deshabilitado y se habilita al cambiar algo', () => {
      const { fixture } = setup();
      openPopover(fixture);
      expect(applyBtn(fixture).disabled).toBe(true);

      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(applyBtn(fixture).disabled).toBe(false);
    });

    it('"Aplicar" vuelve a deshabilitarse si se vuelve al valor aplicado', () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(applyBtn(fixture).disabled).toBe(false);

      category(fixture).value = '';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(applyBtn(fixture).disabled).toBe(true);
      expect(host.patches).toHaveLength(0);
    });

    it('Enter dentro del popover aplica', () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      host.patches.length = 0;
      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();

      root(fixture)
        .querySelector<HTMLElement>('[role="dialog"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(host.patches).toEqual([
        { categoryId: 'c1', gender: undefined, includeInactive: undefined, page: 1 },
      ]);
    });

    it('"Limpiar" resetea el borrador sin emitir, y queda el borrador = default', () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      host.patches.length = 0;
      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      gender(fixture).value = String(Gender.Hombre);
      gender(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();

      clearBtn(fixture).click();
      fixture.detectChanges();

      expect(host.patches).toHaveLength(0);
      expect(category(fixture).value).toBe('');
      expect(gender(fixture).value).toBe('');
      expect(inactive(fixture).getAttribute('aria-checked')).toBe('false');
    });

    it('"Limpiar" se habilita solo si hay algo puesto en el popover', () => {
      const { fixture } = setup();
      openPopover(fixture);
      expect(clearBtn(fixture).disabled).toBe(true);
      inactive(fixture).click();
      fixture.detectChanges();
      expect(clearBtn(fixture).disabled).toBe(false);
    });

    it('al reabrir el popover se descarta el borrador (parte del estado aplicado)', () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();

      filtersBtn(fixture).click(); // cerrar
      fixture.detectChanges();
      filtersBtn(fixture).click(); // reabrir
      fixture.detectChanges();

      expect(category(fixture).value).toBe('');
      expect(host.patches).toHaveLength(0);
    });

    it('los chips siguen mostrando el estado aplicado, no el borrador', () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(chips(fixture)).toHaveLength(0);

      applyBtn(fixture).click();
      fixture.detectChanges();

      expect(host.params().categoryId).toBe('c1');
      expect(chips(fixture)).toHaveLength(1);
    });

    it('sin cambios pendientes "Aplicar" está deshabilitado y no emite', () => {
      const { fixture, host, bar } = setup();
      openPopover(fixture);
      host.patches.length = 0;
      expect(applyBtn(fixture).disabled).toBe(true);

      applyBtn(fixture).click();
      fixture.detectChanges();
      expect(host.patches).toHaveLength(0);
      expect(bar.filtersOpen()).toBe(true);
    });

    it('el valor aplicado se muestra aunque las opciones lleguen después', () => {
      // Las categorías pueden responder más tarde que la apertura del popover;
      // como la selección vive en cada <option> ([selected]), el orden no importa.
      categories.set([]);
      const { fixture, host } = setup();
      host.params.set({ page: 1, pageSize: 10, categoryId: 'c1' });
      fixture.detectChanges();

      openPopover(fixture);
      expect(category(fixture).value).toBe('');

      categories.set([{ id: 'c1', name: 'Calzado' }]);
      fixture.detectChanges();

      expect(category(fixture).value).toBe('c1');
    });

    it('tras aplicar, el popover reabierto muestra el filtro aplicado', async () => {
      const { fixture, host } = setup();
      openPopover(fixture);
      category(fixture).value = 'c1';
      category(fixture).dispatchEvent(new Event('change'));
      fixture.detectChanges();
      applyBtn(fixture).click();
      fixture.detectChanges();
      await fixture.whenStable(); // el host ya propagó el nuevo params

      openPopover(fixture);
      expect(category(fixture).value).toBe('c1');
      expect(host.params().categoryId).toBe('c1');
    });
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

  it('el "Limpiar" de los chips limpia todo y emite clear', () => {
    const { fixture, host } = setup();
    host.params.set({ page: 1, pageSize: 10, categoryId: 'c1' });
    fixture.detectChanges();

    const clear = root(fixture).querySelector<HTMLButtonElement>('[aria-label^="Quitar filtro"]')!;
    clear.click();
    fixture.detectChanges();

    expect(host.patches.at(-1)).toEqual({ categoryId: undefined, page: 1 });
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
