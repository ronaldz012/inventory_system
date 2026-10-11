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
import { ModalStackService } from '@core/modal-stack-service';
import { ItemForm } from '../../../models/variant-form.model';

const item: ItemForm = {
  product: { id: 'p1', productName: 'Zapato', internalCode: 'ZAP', categoryName: 'Calzado', brandName: 'Nike', genderName: '', description: '' },
  variants: [
    {
      mode: 'ex', id: 'v1', sizeId: 's1', sizeName: '35', sizeOrder: 1, colorId: 'c1',
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
  // Los modales son signals: el router mock solo registra navigates reales
  // (detalle creado, cancelar). params$ simula ?modal= residual para probar que se ignora.
  const params$ = new BehaviorSubject<{ get: (k: string) => string | null }>({
    get: () => null,
  });
  const navigateSpy = {
    calls: [] as unknown[],
    flags: [] as (boolean | undefined)[],
    paths: [] as unknown[][],
    fn(commands: unknown[], extras?: { queryParams?: { modal?: string | null }; replaceUrl?: boolean }) {
      const modal = extras?.queryParams?.modal;
      params$.next({ get: () => (modal == null ? null : modal) });
      this.calls.push(modal);
      this.paths.push(commands);
      this.flags.push(extras?.replaceUrl);
      return Promise.resolve(true);
    },
  };

  beforeEach(async () => {
    createSpy.calls = 0;
    createSpy.fail = false;
    navigateSpy.calls = [];
    navigateSpy.flags = [];
    navigateSpy.paths = [];
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
                subscribe: ({
                  next,
                  error,
                }: {
                  next: (result: { id: string }) => void;
                  error: (e: unknown) => void;
                }) => (createSpy.fail ? error({ message: 'Falla' }) : next({ id: 'r1' })),
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

  it('onSubmit con datos válidos abre el confirm por signal sin tocar la URL', () => {
    const { form } = setup();
    form.providerModel.set({ id: 'prov1', name: 'Proveedor 1' });
    form.reception.set({ notes: '', items: [item] });
    form.onSubmit();
    expect(navigateSpy.calls).not.toContain('confirm');
    expect(navigateSpy.paths).toEqual([]);
    expect(form.showConfirm()).toBe(true);
    expect(TestBed.inject(ModalStackService).isEmpty()).toBe(false);
    expect(createSpy.calls).toBe(0);
  });

  it('executeCreate envía el payload y navega al detalle creado con replace', () => {
    const { form } = setup();
    form.providerModel.set({ id: 'prov1', name: 'Proveedor 1' });
    form.reception.set({ notes: '', items: [item] });
    form.executeCreate();
    expect(createSpy.calls).toBe(1);
    expect(form.isSubmitting()).toBe(false);
    expect(navigateSpy.paths).toContainEqual(['inventory', 'receptions', 'r1']);
    expect(navigateSpy.flags).toContain(true);
  });

  it('sin proveedor no abre el confirm y muestra error', () => {
    const { form } = setup();
    form.reception.set({ notes: '', items: [item] });
    form.onSubmit();
    expect(form.showConfirm()).toBe(false);
    expect(form.submitError()).toContain('proveedor');
    expect(createSpy.calls).toBe(0);
  });

  it('closeConfirm no cierra mientras se está enviando y no toca el historial', () => {
    const { form } = setup();
    openConfirm(form);
    expect(form.showConfirm()).toBe(true);
    form.isSubmitting.set(true);
    form.closeConfirm();
    expect(form.showConfirm()).toBe(true);
    form.isSubmitting.set(false);
    form.closeConfirm();
    // Cierre puro estado: sin back(), sin navigate
    expect(form.showConfirm()).toBe(false);
    expect(backSpy.calls).toBe(0);
    expect(navigateSpy.paths).toEqual([]);
  });

  it('error del POST mantiene el modal abierto y muestra el error para reintentar', () => {
    const { form } = setup();
    openConfirm(form);
    createSpy.fail = true;
    form.executeCreate();
    expect(createSpy.calls).toBe(1);
    expect(form.showConfirm()).toBe(true);
    expect(backSpy.calls).toBe(0);
    expect(form.submitError()).toContain('Falla');
    // Reintento sin reabrir: el backend ahora responde bien
    createSpy.fail = false;
    form.executeCreate();
    expect(createSpy.calls).toBe(2);
    expect(navigateSpy.paths).toContainEqual(['inventory', 'receptions', 'r1']);
  });

  it('closeConfirm con el modal ya cerrado no toca nada', () => {
    const { form } = setup();
    openConfirm(form);
    form.closeConfirm();
    expect(form.showConfirm()).toBe(false);
    form.closeConfirm();
    // Sin back() (saldría del form) ni navigates
    expect(backSpy.calls).toBe(0);
    expect(navigateSpy.paths).toEqual([]);
    expect(form.showConfirm()).toBe(false);
  });

  it('openAddCatalogueModal abre por signal sin tocar URL ni historial', () => {
    const { form } = setup();
    form.openAddCatalogueModal();
    expect(form.showAddCatalogueModal()).toBe(true);
    expect(navigateSpy.paths).toEqual([]);
    expect(backSpy.calls).toBe(0);
  });

  it('notFound cambia de catalogue a crear-producto sin historial', () => {
    const { form } = setup();
    form.openAddCatalogueModal();
    form.onNotFound('zapato');
    expect(form.showAddCatalogueModal()).toBe(false);
    expect(form.showCreateProductModal()).toBe(true);
    expect(form.pendingName()).toBe('zapato');
    expect(navigateSpy.paths).toEqual([]);
    expect(backSpy.calls).toBe(0);
  });

  it('cadena catalogue→product→catalogue→add cierra directo sin back()', () => {
    const { form } = setup();
    form.openAddCatalogueModal();
    form.onNotFound('zapato');
    form.onProductCreated({
      id: 'p2', name: 'Botín', internalCode: 'BOT', description: '',
      basePrice: 100, brandName: 'Nike', categoryName: 'Calzado',
      gender: 0, productVariants: [],
    } as never);
    expect(form.showAddCatalogueModal()).toBe(true);
    expect(form.showCreateProductModal()).toBe(false);
    form.addGroup({ index: null, item });
    expect(form.showAddCatalogueModal()).toBe(false);
    expect(form.reception().items.length).toBe(1);
    expect(backSpy.calls).toBe(0);
    expect(navigateSpy.paths).toEqual([]);
  });

  it('?modal= en URL se ignora: los modales solo abren por signals', () => {
    const { form } = setup();
    params$.next({ get: () => 'catalogue' });
    expect(form.showAddCatalogueModal()).toBe(false);
    expect(form.showConfirm()).toBe(false);
  });

  it('editGroup abre el edit con el ítem por signal', () => {
    const { form } = setup();
    form.reception.set({ notes: '', items: [item] });
    form.editGroup(0);
    expect(form.showEditModal()).toBe(true);
    expect(form.editingItem()?.index).toBe(0);
    expect(navigateSpy.paths).toEqual([]);
    expect(backSpy.calls).toBe(0);
  });

  it('el confirm se registra en la pila y closeTop lo cierra sin navegar', () => {
    const { form } = setup();
    const stack = TestBed.inject(ModalStackService);
    expect(stack.isEmpty()).toBe(true);
    openConfirm(form);
    expect(stack.isEmpty()).toBe(false);
    expect(stack.closeTop()).toBe(true);
    expect(form.showConfirm()).toBe(false);
    expect(stack.isEmpty()).toBe(true);
    expect(navigateSpy.paths).toEqual([]);
    expect(createSpy.calls).toBe(0);
  });

  it('la vista muestra productos, unidades y costo total', () => {
    const { fixture, form } = setup();
    const [base] = item.variants;
    form.reception.set({
      notes: '',
      items: [
        {
          ...item,
          variants: [
            { ...base, id: 'v1', quantityReceived: 10, unitCost: 5 },
            { ...base, id: 'v2', quantityReceived: 14, unitCost: 10 },
          ],
        },
      ],
    });
    fixture.detectChanges();

    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('Productos (1)');
    expect(text).toContain('24');
    expect(text).toContain('190');
  });
});
