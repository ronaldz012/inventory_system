import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UpdateProductModal } from './update-product-modal';
import { ProductDetailDto } from '../../../dtos/products/product-detail-dto';
import { Gender } from '../../../interfaces/gender';
import { CategoryService } from '../../../services/category-service';

const product: ProductDetailDto = {
  id: 'p1',
  name: 'Zapato',
  internalCode: 'ZAP',
  description: 'Cuero genuino',
  basePrice: 100,
  gender: Gender.Unisex,
  categoryId: 'c1',
  categoryName: 'Calzado',
  brandId: 'b1',
  brandName: 'Nike',
  totalAvailable: 10,
  isActive: true,
  variants: [],
};

@Component({
  standalone: true,
  imports: [UpdateProductModal],
  template: `<app-update-product-modal [product]="product" />`,
})
class Host {
  product = product;
}

describe('UpdateProductModal', () => {
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
    const modal = fixture.debugElement.children[0].componentInstance as UpdateProductModal;
    const saved: unknown[] = [];
    const closed: unknown[] = [];
    (modal.save as unknown as { emit: (v: unknown) => void }).emit = (v) =>
      void saved.push(v);
    (modal.close as unknown as { emit: () => void }).emit = () => void closed.push(1);
    return { fixture, modal, saved, closed };
  }

  it('guardar sin tocar nada cierra sin emitir save', () => {
    const { modal, saved, closed } = setup();
    modal.onSave();
    expect(saved.length).toBe(0);
    expect(closed.length).toBe(1);
  });

  it('cambiar solo el nombre envía solo el nombre', () => {
    const { modal, saved } = setup();
    modal.productForm.name().value.set('Zapato Nuevo');
    modal.onSave();
    expect(saved).toEqual([{ name: 'Zapato Nuevo' }]);
  });

  it('vaciar la descripción cuenta como cambio y envía ""', () => {
    const { modal, saved } = setup();
    modal.productForm.description().value.set('');
    modal.onSave();
    expect(saved).toEqual([{ description: '' }]);
  });

  it('nombre inválido bloquea el guardado', () => {
    const { fixture, modal, saved } = setup();
    modal.productForm.name().value.set('AB');
    modal.productForm.name().markAsTouched();
    fixture.detectChanges();
    expect(modal.productForm().invalid()).toBe(true);
    modal.onSave();
    expect(saved.length).toBe(0);
    const saveBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as HTMLElement).textContent?.includes('Guardar')) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    const error = fixture.nativeElement.textContent as string;
    expect(error).toContain('Mínimo 3 caracteres.');
  });

  it('espacios sobrantes no marcan cambio', () => {
    const { modal, saved, closed } = setup();
    modal.productForm.name().value.set('Zapato  ');
    modal.onSave();
    expect(saved.length).toBe(0);
    expect(closed.length).toBe(1);
  });
});
