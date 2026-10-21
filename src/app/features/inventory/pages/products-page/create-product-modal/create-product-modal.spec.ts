import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import CreateProductModal from './create-product-modal';
import { ProductService } from '../../../services/product-service';
import { ColorService } from '../../../services/color-service';
import { SizeService } from '../../../services/size-service';
import { BrandService } from '../../../services/brand-service';
import { CategoryService } from '../../../services/category-service';
import { ToastService } from '@core/services/toast-service';
import { SizeSelectCtrl } from '../../../components/size-select-ctrl/size-select-ctrl.component';
import { ColorSelectCtrl } from '../../../components/color-select-ctrl/color-select-ctrl.component';
import { ProductSearchResult } from '@features/inventory/components/product-search/product-search-result.component';

describe('CreateProductModal', () => {
  const colors = [
    { id: 'c1', name: 'Rojo', isActive: true },
    { id: 'c2', name: 'Azul', isActive: true },
  ];
  const sizes = [
    { id: 's40', name: '40', sortOrder: 1, isActive: true },
    { id: 's41', name: '41', sortOrder: 2, isActive: true },
    { id: 's44', name: '44', sortOrder: 5, isActive: true },
  ];
  let dto: unknown;

  beforeEach(async () => {
    dto = undefined;
    await TestBed.configureTestingModule({
      imports: [CreateProductModal],
      providers: [
        {
          provide: ProductService,
          useValue: {
            createProductWithVariants: (body: unknown) => {
              dto = body;
              return of({
                id: 'p1',
                name: 'Zapato',
                internalCode: 'ZAP',
                description: '',
                brandName: 'Nike',
                categoryName: 'Calzado',
                gender: 0,
                isActive: true,
                variants: [
                  {
                    id: 'v1',
                    sku: 'S1',
                    size: '40',
                    sizeId: 's40',
                    sizeOrder: 1,
                    colorId: 'c1',
                    colorName: 'Azul',
                    price: 160,
                  },
                  {
                    id: 'v2',
                    sku: 'S2',
                    size: '44',
                    sizeId: 's44',
                    sizeOrder: 5,
                    colorId: 'c1',
                    colorName: 'Azul',
                    price: 160,
                  },
                ],
              });
            },
          },
        },
        { provide: ColorService, useValue: { load: () => {}, colors: signal(colors) } },
        {
          provide: SizeService,
          useValue: { load: () => {}, sizes: signal(sizes), loading: signal(false) },
        },
        { provide: BrandService, useValue: { brands: signal([]) } },
        { provide: CategoryService, useValue: { categories: signal([]) } },
        { provide: ToastService, useValue: { success: () => {}, error: () => {} } },
        { provide: Router, useValue: { navigate: () => {} } },
      ],
    }).compileComponents();
  });

  function setup() {
    const fixture = TestBed.createComponent(CreateProductModal);
    fixture.detectChanges();
    const form = fixture.componentInstance;
    return { fixture, form };
  }

  function setBulkPrice(form: CreateProductModal, value: string): void {
    const input = document.createElement('input');
    input.value = value;
    form.onBulkPriceChange({ target: input } as unknown as Event);
  }

  it('aplica el precio masivo y aplana en orden', () => {
    const { fixture, form } = setup();
    const emitted: ProductSearchResult[] = [];
    form.created.subscribe((product) => emitted.push(product));
    fixture.componentRef.setInput('returnMode', true);
    expect(form.newProduct().colorGroups.length).toBe(1);

    form.addSize(0, sizes[0]);
    form.addSize(0, sizes[2]);
    fixture.detectChanges();

    // Las tallas nuevas nacen sin precio.
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([null, null]);
    const priceInputs = fixture.nativeElement.querySelectorAll(
      'app-create-color-group input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(priceInputs.length).toBe(2);

    // El precio masivo solo se aplica al pedirlo.
    setBulkPrice(form, '150');
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([null, null]);
    form.applyBulkPrice();
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([150, 150]);

    // Una talla agregada después no hereda nada.
    form.addSize(0, sizes[1]);
    expect(form.newProduct().colorGroups[0].sizes[2].price).toBeNull();
    form.removeSize(0, 2);

    // El precio individual se respeta hasta la próxima aplicación masiva.
    form.newProduct.update((m) => ({
      ...m,
      colorGroups: m.colorGroups.map((g, i) =>
        i === 0 ? { ...g, sizes: g.sizes.map((s, j) => (j === 1 ? { ...s, price: 175 } : s)) } : g,
      ),
    }));
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([150, 175]);

    setBulkPrice(form, '160');
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([150, 175]);
    form.applyBulkPrice();
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([160, 160]);

    // Datos requeridos + color.
    form.newProduct.update((m) => ({
      ...m,
      newProduct: {
        ...m.newProduct,
        name: 'Zapato',
        brandId: 'b1',
        brandName: 'Nike',
        categoryId: 'c1',
        categoryName: 'Calzado',
        gender: '0',
      },
      colorGroups: m.colorGroups.map((g) => ({ ...g, colorId: 'c1', colorName: 'Azul' })),
    }));

    form.onConfirm();
    expect(dto).toEqual({
      name: 'Zapato',
      description: '',
      categoryId: 'c1',
      brandId: 'b1',
      gender: 0,
      variants: [
        { sizeId: 's40', colorId: 'c1', price: 160 },
        { sizeId: 's44', colorId: 'c1', price: 160 },
      ],
    });

    // La respuesta se usa tal cual: count calculado y variantes completas.
    expect(emitted).toHaveLength(1);
    expect(emitted[0].variantsCount).toBe(2);
    expect(
      emitted[0].productVariants.map(({ id, sizeId, colorId, price }) => ({
        id,
        sizeId,
        colorId,
        price,
      })),
    ).toEqual([
      { id: 'v1', sizeId: 's40', colorId: 'c1', price: 160 },
      { id: 'v2', sizeId: 's44', colorId: 'c1', price: 160 },
    ]);
  });

  it('el selector de talla busca, excluye las usadas y agrega al elegir', () => {
    const { fixture, form } = setup();

    const picker = fixture.debugElement.query(By.directive(SizeSelectCtrl))
      .componentInstance as SizeSelectCtrl;

    expect(picker.sizeOptions().map((o) => o.id)).toEqual(['s40', 's41', 's44']);

    form.addSize(0, sizes[0]);
    fixture.detectChanges();
    expect(picker.sizeOptions().map((o) => o.id)).toEqual(['s41', 's44']);

    // Una talla existente (aunque esté excluida) no ofrece "crear".
    picker.query.set('40');
    expect(picker.showCreateOption()).toBe(false);

    // Una talla nueva sí ofrece crearla.
    picker.query.set('45');
    expect(picker.showCreateOption()).toBe(true);

    // Elegir agrega al grupo sin precio y limpia el combo.
    picker.selectOption({ id: 's41', displayName: '41' });
    fixture.detectChanges();

    const group = form.newProduct().colorGroups[0];
    expect(group.sizes.map((s) => s.sizeId)).toEqual(['s40', 's41']);
    expect(group.sizes[1].price).toBeNull();
    expect(picker.query()).toBe('');

    // El precio masivo alcanza también a las tallas agregadas desde el combo.
    setBulkPrice(form, '120');
    form.applyBulkPrice();
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([120, 120]);
  });

  it('mantiene los precios hasta que se aplica el precio masivo', () => {
    const { form } = setup();
    form.addSize(0, sizes[0]);
    form.addSize(0, sizes[1]);
    form.newProduct.update((m) => ({
      ...m,
      colorGroups: m.colorGroups.map((g) => ({
        ...g,
        sizes: g.sizes.map((s, i) => (i === 1 ? { ...s, price: 130 } : s)),
      })),
    }));

    setBulkPrice(form, '100');
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([null, 130]);

    setBulkPrice(form, '110');
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([null, 130]);

    form.applyBulkPrice();
    expect(form.newProduct().colorGroups[0].sizes.map((s) => s.price)).toEqual([110, 110]);
  });

  it('duplica una tarjeta con sus tallas y deja el color por elegir', () => {
    const { fixture, form } = setup();
    form.addSize(0, sizes[0]);
    form.addColorGroup();
    form.addSize(1, sizes[2]);
    setBulkPrice(form, '110');
    form.applyBulkPrice();
    fixture.detectChanges();

    // La copia se inserta justo después de la tarjeta original.
    form.duplicateColorGroup(0);
    fixture.detectChanges();

    const groups = form.newProduct().colorGroups;
    expect(groups.map((g) => g.sizes.map((s) => s.sizeId))).toEqual([['s40'], ['s40'], ['s44']]);
    expect(groups[1].colorId).toBe('');
    expect(groups[1].colorName).toBe('');
    expect(groups[1].sizes.map((s) => s.price)).toEqual([110]);
    // La original conserva sus tallas.
    expect(groups[0].sizes.map((s) => s.sizeId)).toEqual(['s40']);
  });

  it('excluye de cada tarjeta los colores elegidos en las demás', () => {
    const { fixture, form } = setup();
    form.addColorGroup();
    form.newProduct.update((m) => ({
      ...m,
      colorGroups: [
        { ...m.colorGroups[0], id: 'cg-a', colorId: 'c1', colorName: 'Rojo' },
        { ...m.colorGroups[1], id: 'cg-b', colorId: 'c2', colorName: 'Azul' },
      ],
    }));
    fixture.detectChanges();

    const selectors = fixture.debugElement
      .queryAll(By.directive(ColorSelectCtrl))
      .map((debugEl) => debugEl.componentInstance as ColorSelectCtrl);

    expect(selectors.map((selector) => selector.availableColorOptions().map((o) => o.id))).toEqual([
      ['c1'],
      ['c2'],
    ]);
  });

  it('bloquea un color sin tallas', () => {
    const { form } = setup();
    form.newProduct.update((m) => ({
      ...m,
      newProduct: {
        ...m.newProduct,
        name: 'Zapato',
        brandId: 'b1',
        categoryId: 'c1',
        gender: '0',
      },
      colorGroups: [{ ...m.colorGroups[0], id: 'cg-test-1', colorId: 'c1', colorName: 'Azul' }],
    }));

    form.onConfirm();
    expect(dto).toBeUndefined();
    expect(form.error()).toBeTruthy();
    expect(form.newProductForm().invalid()).toBe(true);
  });
});
