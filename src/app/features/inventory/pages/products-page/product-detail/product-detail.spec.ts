import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import ProductDetail from './product-detail';
import { ProductService } from '../../../services/product-service';
import { BranchContextService } from '@core/services/branch-context-service';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ProductDetailDto, ProductVariantDto } from '../../../dtos/products/product-detail-dto';
import { Gender } from '../../../interfaces/gender';
import { UpdateVariantModal } from './product-detail-variant/update-variant-modal';
import { UpdateProductModal } from './update-product-modal';

const BRANCH = 'b-centro';

const product: ProductDetailDto = {
  id: 'p1',
  name: 'Zapato',
  internalCode: 'ZAP',
  description: '',
  basePrice: 100,
  gender: Gender.Hombre,
  categoryId: 'c1',
  categoryName: 'Calzado',
  brandId: 'br1',
  brandName: 'Nike',
  totalAvailable: 24,
  isActive: true,
  variants: [
    // Orden del backend: Azul 42, Azul 44, Negro 44
    {
      id: 'v1',
      sku: 'SKU-1',
      description: '',
      size: '42',
      sizeId: 's42',
      color: 'Azul',
      colorId: 'co-azul',
      price: 100,
      totalAvailable: 9,
      branchStocks: [{ branchId: BRANCH, branchName: 'Centro', stock: 5 }],
    },
    {
      id: 'v2',
      sku: 'SKU-2',
      description: '',
      size: '44',
      sizeId: 's44',
      color: 'Azul',
      colorId: 'co-azul',
      price: 100,
      totalAvailable: 9,
      branchStocks: [{ branchId: BRANCH, branchName: 'Centro', stock: 9 }],
    },
    {
      id: 'v3',
      sku: 'SKU-3',
      description: '',
      size: '44',
      sizeId: 's44',
      color: 'Negro',
      colorId: 'co-negro',
      price: 100,
      totalAvailable: 1,
      branchStocks: [{ branchId: BRANCH, branchName: 'Centro', stock: 1 }],
    },
  ],
};

@Component({
  standalone: true,
  imports: [ProductDetail],
  template: `<app-product-detail />`,
})
class Host {}

describe('ProductDetail menú de orden', () => {
  let activeBranch: string | null = BRANCH;
  let deferProduct = false;
  let deliverProduct: (() => void) | null = null;
  const updateCalls: unknown[][] = [];
  const params$ = new BehaviorSubject<{ get: (k: string) => string | null }>({ get: () => null });

  const modalParam = (value: string | null) =>
    params$.next({ get: (k: string) => (k === 'modal' ? value : null) });

  beforeEach(async () => {
    activeBranch = BRANCH;
    deferProduct = false;
    deliverProduct = null;
    updateCalls.length = 0;
    params$.next({ get: () => null });
    // happy-dom no implementa scrollIntoView: stub global para evitar timers huérfanos
    Element.prototype.scrollIntoView = vi.fn();
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: params$.asObservable(),
            snapshot: { paramMap: { get: () => 'p1' } },
          },
        },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        {
          provide: ProductService,
          useValue: {
            getById: () => ({
              subscribe: ({ next }: { next: (p: ProductDetailDto) => void }) => {
                deliverProduct = () => next(product);
                if (!deferProduct) deliverProduct();
              },
            }),
            update: (id: string, dto: unknown) => {
              updateCalls.push([id, dto]);
              return { subscribe: ({ next }: { next: () => void }) => next() };
            },
          },
        },
        { provide: BranchContextService, useValue: { getActiveBranchId: () => activeBranch } },
        { provide: ToastService, useValue: { success: () => {}, error: () => {} } },
        { provide: PermissionService, useValue: { canUpdate: () => true, canDelete: () => true } },
      ],
    }).compileComponents();
  });

  function setup(): { fixture: ComponentFixture<Host>; form: ProductDetail } {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const form = fixture.debugElement.children[0].componentInstance as ProductDetail;
    return { fixture, form };
  }

  const trigger = (root: HTMLElement): HTMLButtonElement =>
    root.querySelector<HTMLButtonElement>('[data-sort-menu] button')!;

  const menu = (root: HTMLElement): HTMLElement | null =>
    root.querySelector<HTMLElement>('[role="menu"]');

  const menuItems = (root: HTMLElement): HTMLButtonElement[] =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));

  const searchInput = (root: HTMLElement): HTMLInputElement =>
    root.querySelector<HTMLInputElement>('input[aria-label^="Buscar variantes"]')!;

  describe('buscador en mobile', () => {
    it('Enter baja el teclado (blur) sin cambiar el filtro', () => {
      const { fixture } = setup();
      const root = fixture.nativeElement as HTMLElement;
      const input = searchInput(root);
      input.focus();
      input.value = 'azul';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(document.activeElement).not.toBe(input);
      expect(input.value).toBe('azul');
    });

    it('el input declara enterkeyhint=search para el teclado virtual', () => {
      const { fixture } = setup();
      const input = searchInput(fixture.nativeElement as HTMLElement);
      expect(input.getAttribute('enterkeyhint')).toBe('search');
    });

    it('al enfocar programa el scroll del buscador (teclado no tapa la lista)', () => {
      vi.useFakeTimers();
      try {
        const { fixture } = setup();
        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelector<HTMLElement>('[class*="scroll-mt-16"]')).not.toBeNull();
        const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

        searchInput(root).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        expect(scrollSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('arranca con el orden del backend y el menú cerrado', () => {
    const { fixture, form } = setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(form.sortMode()).toBe('off');
    expect(menu(root)).toBeNull();
    expect(form.sortedVariants().map((v) => v.sku)).toEqual(['SKU-1', 'SKU-2', 'SKU-3']);
  });

  it('abre el menú con 3 opciones y marca la seleccionada', () => {
    const { fixture, form } = setup();
    const root = fixture.nativeElement as HTMLElement;
    trigger(root).click();
    fixture.detectChanges();

    expect(form.sortMenuOpen()).toBe(true);
    expect(trigger(root).getAttribute('aria-expanded')).toBe('true');
    const items = menuItems(root);
    // el ligature del ícono "check" vive en el DOM: se quita para comparar texto
    const label = (el: HTMLElement) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').replace('check ', '').trim();
    expect(items.map(label)).toEqual([
      'Orden por defecto',
      'Stock: mayor a menor',
      'Stock: menor a mayor',
    ]);
    expect(items.map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });

  it('seleccionar "Stock: mayor a menor" ordena la lista y cierra el menú', () => {
    const { fixture, form } = setup();
    const root = fixture.nativeElement as HTMLElement;
    trigger(root).click();
    fixture.detectChanges();
    menuItems(root)[1].click();
    fixture.detectChanges();

    expect(form.sortMode()).toBe('desc');
    expect(menu(root)).toBeNull();
    expect(form.sortedVariants().map((v) => v.sku)).toEqual(['SKU-2', 'SKU-1', 'SKU-3']);
    expect((trigger(root).textContent ?? '').replace(/\s+/g, ' ')).toContain('Stock ↓');
  });

  it('"Orden por defecto" restaura el orden del backend', () => {
    const { fixture, form } = setup();
    const root = fixture.nativeElement as HTMLElement;
    trigger(root).click();
    fixture.detectChanges();
    menuItems(root)[1].click();
    fixture.detectChanges();
    trigger(root).click();
    fixture.detectChanges();
    menuItems(root)[0].click();
    fixture.detectChanges();

    expect(form.sortMode()).toBe('off');
    expect(form.sortedVariants().map((v) => v.sku)).toEqual(['SKU-1', 'SKU-2', 'SKU-3']);
  });

  it('Escape cierra el menú', () => {
    const { fixture, form } = setup();
    const root = fixture.nativeElement as HTMLElement;
    trigger(root).click();
    fixture.detectChanges();
    menu(root)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(form.sortMenuOpen()).toBe(false);
    expect(menu(root)).toBeNull();
  });

  it('click fuera del menú lo cierra', () => {
    const { fixture, form } = setup();
    const root = fixture.nativeElement as HTMLElement;
    trigger(root).click();
    fixture.detectChanges();
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(form.sortMenuOpen()).toBe(false);
  });

  it('sin sucursal activa el botón queda deshabilitado y no ordena', () => {
    activeBranch = null;
    const { fixture, form } = setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(trigger(root).disabled).toBe(true);
    expect(form.sortedVariants().map((v) => v.sku)).toEqual(['SKU-1', 'SKU-2', 'SKU-3']);
  });

  describe('modales por query param', () => {
    const variantModal = (root: HTMLElement) =>
      root.querySelector('app-update-variant-modal') as UpdateVariantModal | null;

    it('abre el modal de variante aunque el producto cargue después', () => {
      deferProduct = true;
      modalParam('edit:v2');
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      const form = fixture.debugElement.children[0].componentInstance as ProductDetail;

      // el query param ya está, pero el producto todavía no: sin crashear
      expect(form.editingVariant()).toBeNull();
      expect(variantModal(fixture.nativeElement as HTMLElement)).toBeNull();

      deliverProduct!();
      fixture.detectChanges();

      expect(form.editingVariant()?.sku).toBe('SKU-2');
      expect(variantModal(fixture.nativeElement as HTMLElement)).not.toBeNull();
    });

    it('los tres modales de variante resuelven su variante desde la URL', () => {
      const cases: [string, () => ProductVariantDto | null][] = [
        ['edit:v3', () => null],
        ['delete:v3', () => null],
        ['adjust:v3', () => null],
      ];
      for (const [param] of cases) {
        modalParam(param);
        const { fixture, form } = setup();
        expect(
          form.editingVariant()?.sku ??
            form.deletingVariant()?.sku ??
            form.adjustingStockVariant()?.sku,
        ).toBe('SKU-3');
      }
    });

    it('?modal=edit-full y ?modal=product abren sus modales; ?modal=bulk-prices también', () => {
      for (const [param, selector] of [
        ['edit-full', 'app-product-edit-panel'],
        ['product', 'app-update-product-modal'],
        ['bulk-prices', 'app-bulk-price-modal'],
        ['add-variant', 'app-add-variant-modal'],
        ['delete-product', 'app-confirm-action-modal'],
        ['toggle-status', 'app-confirm-action-modal'],
      ] as const) {
        modalParam(param);
        const fixture = TestBed.createComponent(Host);
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        expect(root.querySelector(selector), `modal ${param}`).not.toBeNull();
      }
    });

    it('quitar el query param cierra el modal', () => {
      modalParam('edit:v2');
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      const form = fixture.debugElement.children[0].componentInstance as ProductDetail;
      expect(form.editingVariant()).not.toBeNull();

      modalParam(null);
      fixture.detectChanges();
      expect(form.editingVariant()).toBeNull();
    });

    it('?modal=product reutiliza el mismo guardado que edit-full (un solo PUT)', () => {
      modalParam('product');
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      const modal = fixture.debugElement.query(By.directive(UpdateProductModal))
        .componentInstance as UpdateProductModal;
      modal.save.emit({ name: 'Zapato nuevo' });
      fixture.detectChanges();

      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][0]).toBe('p1');
      expect(updateCalls[0][1]).toEqual({ name: 'Zapato nuevo' });
    });
  });
});
