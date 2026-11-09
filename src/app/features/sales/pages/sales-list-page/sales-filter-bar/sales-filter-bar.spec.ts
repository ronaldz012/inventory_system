import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SaleService } from '@features/sales/services/sale-service';
import { SalesQueryDto } from '@features/sales/dtos/sales-query-dto';
import { SaleReturnStatus, SaleType } from '@features/sales/dtos/sale-detail-dto';
import { SalesFilterBar } from './sales-filter-bar';

@Component({
  standalone: true,
  imports: [SalesFilterBar],
  template: `<app-sales-filter-bar
    [params]="params()"
    (change)="changes.push($event)"
    (clear)="clearCount = clearCount + 1"
  />`,
})
class Host {
  params = signal<SalesQueryDto>({ type: SaleType.Sale, page: 1, pageSize: 10 });
  changes: Partial<SalesQueryDto>[] = [];
  clearCount = 0;
}

async function setup(params: Partial<SalesQueryDto> = {}) {
  await TestBed.configureTestingModule({
    imports: [Host],
    // Sin vendedores: el control de vendedor no se renderiza en estos tests.
    providers: [{ provide: SaleService, useValue: { getSellers: () => of([]) } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.params.set({
    type: SaleType.Sale,
    page: 1,
    pageSize: 10,
    ...params,
  });
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const tabs = root.querySelector('[role="group"]') as HTMLElement;
  const tabByText = (text: string) =>
    Array.from(tabs.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    ) as HTMLButtonElement;
  const search = root.querySelector('input[type="text"]') as HTMLInputElement;
  const type = (value: string) => {
    search.value = value;
    search.dispatchEvent(new Event('input'));
  };
  const openFilters = () => {
    (root.querySelector('[data-sales-filters] button') as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  const popoverButton = (text: string) =>
    Array.from(root.querySelectorAll('[data-sales-filters] button')).find(
      (b) => b.textContent?.trim() === text,
    ) as HTMLButtonElement;

  return {
    fixture,
    host: fixture.componentInstance,
    root,
    tabByText,
    search,
    type,
    openFilters,
    popoverButton,
  };
}

describe('SalesFilterBar', () => {
  afterEach(() => vi.useRealTimers());

  it('cambia a devoluciones y descarta el estado de devolución', async () => {
    const { fixture, host, tabByText } = await setup({
      returnStatus: SaleReturnStatus.Partial,
    });

    tabByText('Devoluciones').click();
    fixture.detectChanges();

    expect(host.changes).toEqual([{ type: SaleType.Return, returnStatus: undefined, page: 1 }]);
  });

  it('no emite nada al elegir la pestaña ya activa', async () => {
    const { fixture, host, tabByText } = await setup();

    tabByText('Ventas').click();
    fixture.detectChanges();

    expect(host.changes).toEqual([]);
  });

  it('aplica la búsqueda con debounce y limpia el `#`', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { fixture, host, type } = await setup();

    type('  #28 ');
    expect(host.changes).toEqual([]);

    vi.advanceTimersByTime(400);
    expect(host.changes).toEqual([{ filter: '28', page: 1 }]);
    fixture.detectChanges();
  });

  it('Enter aplica la búsqueda al instante', async () => {
    const { fixture, host, search, type } = await setup();

    type('SKU-001');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(host.changes).toEqual([{ filter: 'SKU-001', page: 1 }]);
    fixture.detectChanges();
  });

  it('no emite cuando el texto no cambia el filtro', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { fixture, host, type } = await setup();

    type('#');
    vi.advanceTimersByTime(400);

    expect(host.changes).toEqual([]);
    fixture.detectChanges();
  });

  it('no pisa el texto tipeado si otro parámetro cambia antes del debounce', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { fixture, host, search, type } = await setup();

    type('nike');
    host.params.set({ type: SaleType.Sale, page: 2, pageSize: 10 });
    fixture.detectChanges();

    expect(search.value).toBe('nike');

    vi.advanceTimersByTime(400);
    expect(host.changes).toEqual([{ filter: 'nike', page: 1 }]);
  });

  it('adopta el filtro cuando cambia desde afuera (atrás/adelante)', async () => {
    const { fixture, host, search } = await setup();

    host.params.set({ type: SaleType.Sale, page: 1, pageSize: 10, filter: '28' });
    fixture.detectChanges();

    expect(search.value).toBe('28');
  });

  it('el filtro de estado aparece en ventas', async () => {
    const { root, openFilters } = await setup();

    openFilters();

    expect(root.querySelector('#filtro-estado-devolucion')).not.toBeNull();
  });

  it('en devoluciones no hay filtros si no hay vendedores cargados', async () => {
    const { root } = await setup({ type: SaleType.Return });

    expect(root.querySelector('[data-sales-filters]')).toBeNull();
  });

  it('el select solo edita el borrador: recién "Aplicar" emite y cierra', async () => {
    const { fixture, host, root, openFilters, popoverButton } = await setup();

    openFilters();
    const select = root.querySelector('select') as HTMLSelectElement;
    select.value = String(SaleReturnStatus.Full);
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Cambiar el select no navega: el popover sigue abierto y no hubo emisión.
    expect(host.changes).toEqual([]);
    expect(root.querySelector('select')).not.toBeNull();

    popoverButton('Aplicar').click();
    fixture.detectChanges();

    expect(host.changes).toEqual([
      { soldById: undefined, returnStatus: SaleReturnStatus.Full, page: 1 },
    ]);
    expect(root.querySelector('select')).toBeNull();
  });

  it('"Cancelar" descarta el borrador', async () => {
    const { fixture, host, root, openFilters, popoverButton } = await setup();

    openFilters();
    const select = root.querySelector('select') as HTMLSelectElement;
    select.value = String(SaleReturnStatus.Full);
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    popoverButton('Cancelar').click();
    fixture.detectChanges();

    expect(host.changes).toEqual([]);
    expect(root.querySelector('[data-sales-filters]')).not.toBeNull();

    // Al reabrir muestra el estado aplicado, no el borrador descartado.
    openFilters();
    expect((root.querySelector('select') as HTMLSelectElement).value).toBe('');
  });

  it('"Aplicar" está deshabilitado sin cambios pendientes', async () => {
    const { openFilters, popoverButton } = await setup();

    openFilters();

    expect(popoverButton('Aplicar').disabled).toBe(true);
  });

  it('muestra el chip del estado activo y permite quitarlo', async () => {
    const { fixture, host, root } = await setup({
      returnStatus: SaleReturnStatus.Partial,
    });

    const chip = root.querySelector('button[aria-label^="Quitar filtro"]') as HTMLButtonElement;
    expect(chip.textContent).toContain('Parcialmente devuelta');

    chip.click();
    fixture.detectChanges();

    expect(host.changes).toEqual([{ returnStatus: undefined, page: 1 }]);
  });

  it('"Limpiar" pide al contenedor resetear todos los filtros', async () => {
    const { fixture, host, root } = await setup({ filter: '28' });

    const clear = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Limpiar',
    ) as HTMLButtonElement;
    expect(clear).toBeDefined();

    clear.click();
    fixture.detectChanges();

    expect(host.clearCount).toBe(1);
  });
});
