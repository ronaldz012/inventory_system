import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import ReceptionForm from './reception-form';
import { ReceptionService } from '../../../services/reception-service';
import { CategoryService } from '../../../services/category-service';
import { ColorService } from '../../../services/color-service';
import { BrandService } from '../../../services/brand-service';
import { ProviderService } from '../../../services/provider-service';
import { ToastService } from '@core/services/toast-service';
import { BranchContextService } from '@core/services/branch-context-service';
import { ItemForm } from '../../../models/variant-form.model';

const item: ItemForm = {
  product: { id: 'p1', productName: 'Zapato', internalCode: 'ZAP', categoryName: 'Calzado', brandName: 'Nike', genderName: '', description: '' },
  variants: [
    {
      mode: 'ex', id: 'v1', sizeId: 's1', sizeName: '35', colorId: 'c1',
      colorCode: '', colorName: 'Rojo', quantityReceived: 6, unitCost: 50,
      price: 120, sku: 'SKU-1', selected: true,
    },
  ],
};

@Component({
  standalone: true,
  imports: [ReceptionForm],
  template: `<app-reception-form />`,
})
class Host {}

describe('ReceptionForm confirm flow', () => {
  const createSpy = { calls: 0, fail: false };
  // Emula el historial: navegar con ?modal=X emite el param; con modal:null lo limpia
  const params$ = new BehaviorSubject<{ get: (k: string) => string | null }>({
    get: () => null,
  });
  const navigateSpy = {
    calls: [] as unknown[],
    flags: [] as (boolean | undefined)[],
    fn(commands: unknown[], extras?: { queryParams?: { modal?: string | null }; replaceUrl?: boolean }) {
      const modal = extras?.queryParams?.modal;
      params$.next({ get: () => (modal == null ? null : modal) });
      this.calls.push(modal);
      this.flags.push(extras?.replaceUrl);
      return Promise.resolve(true);
    },
  };

  beforeEach(async () => {
    createSpy.calls = 0;
    createSpy.fail = false;
    navigateSpy.calls = [];
    navigateSpy.flags = [];
    params$.next({ get: () => null });
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap: params$.asObservable() } },
        { provide: Router, useValue: { navigate: (...a: unknown[]) => navigateSpy.fn(a[0] as unknown[], a[1] as never) } },
        {
          provide: ReceptionService,
          useValue: {
            create: () => {
              createSpy.calls++;
              return {
                subscribe: ({ next, error }: { next: () => void; error: (e: unknown) => void }) =>
                  createSpy.fail ? error({ message: 'Falla' }) : next(),
              };
            },
          },
        },
        { provide: CategoryService, useValue: { load: () => {} } },
        { provide: ColorService, useValue: { load: () => {} } },
        { provide: BrandService, useValue: { load: () => {} } },
        { provide: ProviderService, useValue: { load: () => {} } },
        { provide: ToastService, useValue: { error: () => {}, success: () => {} } },
        {
          provide: BranchContextService,
          useValue: { active: signal({ branchId: 'b1', branchName: 'Sucursal A' }) },
        },
      ],
    }).compileComponents();
  });

  const backSpy = { calls: 0 };
  const realBack = window.history.back.bind(window.history);

  beforeEach(() => {
    backSpy.calls = 0;
    window.history.back = () => {
      backSpy.calls++;
    };
  });

  afterEach(() => {
    window.history.back = realBack;
  });

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const form = fixture.debugElement.children[0].componentInstance as ReceptionForm;
    return { fixture, form };
  }

  function openConfirm(form: ReceptionForm): void {
    form.providerModel.set({ id: 'prov1', name: 'Proveedor 1' });
    form.reception.set({ notes: '', items: [item] });
    form.onSubmit();
  }

  it('onSubmit con datos válidos abre el confirm vía URL sin llamar al backend', () => {
    const { form } = setup();
    form.providerModel.set({ id: 'prov1', name: 'Proveedor 1' });
    form.reception.set({ notes: '', items: [item] });
    form.onSubmit();
    expect(navigateSpy.calls).toContain('confirm');
    expect(form.showConfirm()).toBe(true);
    expect(createSpy.calls).toBe(0);
  });

  it('executeCreate envía el payload y navega', () => {
    const { form } = setup();
    form.providerModel.set({ id: 'prov1', name: 'Proveedor 1' });
    form.reception.set({ notes: '', items: [item] });
    form.executeCreate();
    expect(createSpy.calls).toBe(1);
    expect(form.isSubmitting()).toBe(false);
  });

  it('sin proveedor no abre el confirm y muestra error', () => {
    const { form } = setup();
    form.reception.set({ notes: '', items: [item] });
    form.onSubmit();
    expect(form.showConfirm()).toBe(false);
    expect(form.submitError()).toContain('proveedor');
    expect(createSpy.calls).toBe(0);
  });

  it('closeConfirm no cierra mientras se está enviando', () => {
    const { form } = setup();
    openConfirm(form);
    expect(form.showConfirm()).toBe(true);
    form.isSubmitting.set(true);
    form.closeConfirm();
    expect(form.showConfirm()).toBe(true);
    expect(backSpy.calls).toBe(0);
    form.isSubmitting.set(false);
    form.closeConfirm();
    // Consume la entrada con back(): sin navigate(null), sin duplicadas
    expect(backSpy.calls).toBe(1);
    expect(navigateSpy.calls).not.toContain(null);
    // La suscripción cierra al limpiar la URL (emula el pop)
    params$.next({ get: () => null });
    expect(form.showConfirm()).toBe(false);
  });

  it('error del POST cierra vía back() y muestra el error sin duplicar', () => {
    const { form } = setup();
    openConfirm(form);
    createSpy.fail = true;
    form.executeCreate();
    expect(createSpy.calls).toBe(1);
    expect(backSpy.calls).toBe(1);
    expect(navigateSpy.calls).not.toContain(null);
    expect(form.submitError()).toContain('Falla');
    // Al limpiar la URL (pop) el modal cierra y el error queda visible
    params$.next({ get: () => null });
    expect(form.showConfirm()).toBe(false);
  });

  it('si el modal ya se cerró por atrás manual, no se toca el historial', () => {
    const { form } = setup();
    openConfirm(form);
    // Usuario presionó atrás: URL limpia, modal cerrado
    params$.next({ get: () => null });
    expect(form.showConfirm()).toBe(false);
    form.closeConfirm();
    // Sin back() (saldría del form); solo replace no-op del helper
    expect(backSpy.calls).toBe(0);
    expect(form.showConfirm()).toBe(false);
  });

  it('apertura página→modal hace push (sin replaceUrl)', () => {
    const { form } = setup();
    form.openAddCatalogueModal();
    expect(navigateSpy.calls).toContain('catalogue');
    expect(navigateSpy.flags[navigateSpy.flags.length - 1]).toBeFalsy();
    expect(form.showAddCatalogueModal()).toBe(true);
  });

  it('transición modal→modal reutiliza la entrada (replaceUrl)', () => {
    const { form } = setup();
    form.openAddCatalogueModal();
    form.onNotFound('zapato');
    expect(navigateSpy.calls).toContain('product');
    expect(navigateSpy.flags[navigateSpy.flags.length - 1]).toBe(true);
    expect(form.showCreateProductModal()).toBe(true);
  });

  it('cadena catalogue→product→catalogue→add cierra con un solo back()', () => {
    const { form } = setup();
    form.openAddCatalogueModal();
    form.onNotFound('zapato');
    form.onProductCreated({
      id: 'p2', name: 'Botín', internalCode: 'BOT', description: '',
      basePrice: 100, brandName: 'Nike', categoryName: 'Calzado',
      gender: 0, productVariants: [],
    } as never);
    expect(form.showAddCatalogueModal()).toBe(true);
    form.addGroup({ index: null, item });
    // Un solo back() consume la única entrada; nada de navigate(null)
    expect(backSpy.calls).toBe(1);
    expect(navigateSpy.calls).not.toContain(null);
    params$.next({ get: () => null });
    expect(form.showAddCatalogueModal()).toBe(false);
  });

  it('recarga con ?modal= en URL cierra por helper sin tocar historial', () => {
    const { form } = setup();
    params$.next({ get: () => 'catalogue' });
    expect(form.showAddCatalogueModal()).toBe(true);
    form.closeModal();
    expect(backSpy.calls).toBe(0);
    expect(navigateSpy.calls).toContain(null);
  });

  it('atrás del navegador (URL sin modal) cierra el confirm sin salir del form', () => {
    const { form } = setup();
    form.providerModel.set({ id: 'prov1', name: 'Proveedor 1' });
    form.reception.set({ notes: '', items: [item] });
    form.onSubmit();
    expect(form.showConfirm()).toBe(true);
    // Simula popstate: la URL vuelve a no tener ?modal=
    params$.next({ get: () => null });
    expect(form.showConfirm()).toBe(false);
    expect(createSpy.calls).toBe(0);
  });
});
