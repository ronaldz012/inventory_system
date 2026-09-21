import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProductEditPanel } from './product-edit-panel';
import { ProductDetailDto } from '../../../../dtos/products/product-detail-dto';
import { Gender } from '../../../../interfaces/gender';
import { CategoryService } from '../../../../services/category-service';
import { CategorySelectCtrl } from '../../../../components/category-select-ctrl/category-select-ctrl.component';

const variant = (id: string, sku: string, price: number) => ({
  id,
  sku,
  description: '',
  size: '35',
  sizeId: 's1',
  color: 'Rojo',
  colorId: 'c1',
  price,
  totalAvailable: 5,
  branchStocks: [],
});

const product: ProductDetailDto = {
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
  variants: [variant('v1', 'SKU-1', 120), variant('v2', 'SKU-2', 150)],
};

const singleVariantProduct: ProductDetailDto = {
  ...product,
  variants: [variant('v1', 'SKU-1', 120)],
};

@Component({
  standalone: true,
  imports: [ProductEditPanel],
  template: `<app-product-edit-panel [product]="product" />`,
})
class Host {
  product = product;
}

describe('ProductEditPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        {
          provide: CategoryService,
          useValue: { load: () => {}, categories: signal([]) },
        },
      ],
    }).compileComponents();
  });

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const panel = fixture.debugElement.children[0].componentInstance as ProductEditPanel;
    const rowInputs = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="price-rows"] input[type="number"]'),
      ) as HTMLInputElement[];
    const emitted: unknown[] = [];
    (panel.save as unknown as { emit: (v: unknown) => void }).emit = (v) =>
      void emitted.push(v);
    return { fixture, panel, rowInputs, emitted };
  }

  it('inicia cerrado con varias variantes y con filas prefilled', () => {
    const { panel, rowInputs } = setup();
    expect(panel.pricesOpen()).toBe(false);
    expect(rowInputs().length).toBe(0);
    expect(panel.editModel().rows.map((r) => r.newPrice)).toEqual([120, 150]);
    expect(panel.canSave()).toBe(false);
  });

  it('inicia abierto con una sola variante', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.product = singleVariantProduct;
    fixture.detectChanges();
    const panel = fixture.debugElement.children[0].componentInstance as ProductEditPanel;
    expect(panel.pricesOpen()).toBe(true);
  });

  it('editar solo el nombre con precios iguales permite guardar', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.product = {
      ...product,
      variants: [variant('v1', 'SKU-1', 120), variant('v2', 'SKU-2', 120)],
    };
    fixture.detectChanges();
    const panel = fixture.debugElement.children[0].componentInstance as ProductEditPanel;
    panel.editForm.name().value.set('Zapato Nuevo');
    expect(panel.pricesDirty()).toBe(false);
    expect(panel.canSave()).toBe(true);
    expect(panel.summary()).toBe('Se guardará: Datos');
  });

  it('cambiar 1 de N precios envía solo ese', () => {
    const { panel, emitted } = setup();
    panel.editForm.rows[0].newPrice().value.set(130);
    expect(panel.summary()).toBe('Se guardará: 1 precio');
    panel.onSave();
    expect(emitted.length).toBe(1);
    const dto = emitted[0] as { variantPrices?: { variantId: string; price: number }[] };
    expect(dto.variantPrices).toEqual([{ variantId: 'v1', price: 130 }]);
    expect(dto).not.toHaveProperty('name');
  });

  it('precio inválido bloquea el guardado y el encabezado lo alerta', () => {
    const { fixture, panel } = setup();
    panel.editForm.rows[0].newPrice().value.set(null);
    fixture.detectChanges();
    expect(panel.canSave()).toBe(false);
    expect(panel.pricesStatus()).toEqual({ tone: 'error', text: '1 precio inválido' });
    const header = fixture.nativeElement.querySelector('section[aria-label="Precios por variante"]')
      .textContent as string;
    expect(header).toContain('1 precio inválido');
  });

  it('"Aplicar a todas" rellena y luego se puede ajustar individual', () => {
    const { fixture, panel, rowInputs } = setup();
    panel.pricesOpen.set(true);
    fixture.detectChanges();
    panel.showApplyAll.set(true);
    fixture.detectChanges();
    panel.onApplyAllInput({ target: { value: '200' } } as unknown as Event);
    panel.applyAll();
    expect(panel.editModel().rows.map((r) => r.newPrice)).toEqual([200, 200]);
    expect(panel.showApplyAll()).toBe(false);
    // ajuste individual posterior
    panel.editForm.rows[0].newPrice().value.set(210);
    fixture.detectChanges();
    const inputs = rowInputs();
    expect(inputs[0].value).toBe('210');
    expect(inputs[1].value).toBe('200');
    expect(panel.summary()).toBe('Se guardará: 2 precios');
  });

  it('espacios sobrantes no marcan dirty en datos', () => {
    const { panel } = setup();
    panel.editForm.name().value.set('Zapato  ');
    expect(panel.productDirty()).toBe(false);
    expect(panel.canSave()).toBe(false);
  });

  it('seleccionar categoría en el ctrl llega al modelo y marca dirty', () => {
    const { fixture, panel } = setup();
    const ctrl = fixture.debugElement.query(By.directive(CategorySelectCtrl))
      .componentInstance as CategorySelectCtrl;
    ctrl.selectOption({ id: 'c2', displayName: 'Ropa' });
    expect(panel.editModel().categoryId).toBe('c2');
    expect(panel.editModel().categoryName).toBe('Ropa');
    expect(panel.productDirty()).toBe(true);
    expect(panel.canSave()).toBe(true);
  });
});
