import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import AddVariantModal from './add-variant-modal';
import { ColorService } from '@features/inventory/services/color-service';
import { SizeService } from '@features/inventory/services/size-service';
import { SizeSelectCtrl } from '@features/inventory/components/size-select-ctrl/size-select-ctrl.component';

const variants = [
  { colorId: 'c1', sizeId: 's42', color: 'Rojo', price: 120 },
  { colorId: 'c2', sizeId: 's44', color: 'Azul', price: 150 },
  { colorId: 'c1', sizeId: 's46', color: 'Rojo', price: 120 },
  { colorId: 'c3', sizeId: 's48', color: 'Verde', price: null },
];

describe('AddVariantModal — precios del producto', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddVariantModal],
      providers: [
        { provide: ColorService, useValue: { load: () => {}, add: () => {}, colors: signal([]) } },
        { provide: SizeService, useValue: { load: () => {}, add: () => {}, sizes: signal([]) } },
      ],
    }).compileComponents();
  });

  function setup(withVariants = variants) {
    const fixture = TestBed.createComponent(AddVariantModal);
    fixture.componentRef.setInput('existingVariants', withVariants);
    fixture.detectChanges();
    return {
      fixture,
      modal: fixture.componentInstance,
      root: fixture.nativeElement as HTMLElement,
    };
  }

  const chips = (root: HTMLElement): HTMLButtonElement[] =>
    Array.from(root.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Bs'),
    ) as HTMLButtonElement[];

  const colorChips = (root: HTMLElement): HTMLButtonElement[] =>
    Array.from(root.querySelectorAll('button')).filter((b) =>
      ['Azul', 'Rojo', 'Verde'].includes(b.textContent?.trim() ?? ''),
    ) as HTMLButtonElement[];

  it('muestra los colores distintos del producto', () => {
    const { root } = setup();

    expect(root.textContent).toContain('Colores del producto:');
    expect(colorChips(root).map((b) => b.textContent?.trim())).toEqual(['Azul', 'Rojo', 'Verde']);
  });

  it('un tap en un color lo selecciona y resalta el chip', () => {
    const { fixture, modal, root } = setup();

    colorChips(root)
      .find((b) => b.textContent?.includes('Rojo'))!
      .click();
    fixture.detectChanges();

    expect(modal.model().colorId).toBe('c1');
    expect(modal.model().colorName).toBe('Rojo');
    const active = colorChips(root).find((b) => b.textContent?.includes('Rojo'))!;
    expect(active.classList.contains('!border-accent-ui')).toBe(true);
    expect(active.classList.contains('!text-accent-ui')).toBe(true);
  });

  it('excluye las tallas que ya existen para el color elegido', () => {
    const { fixture, modal } = setup();

    modal.model.update((m) => ({ ...m, colorId: 'c1' }));
    fixture.detectChanges();
    const sizeCtrl = fixture.debugElement.query(By.directive(SizeSelectCtrl))
      .componentInstance as SizeSelectCtrl;
    expect(sizeCtrl.excludeIds()).toEqual(['s42', 's46']);

    modal.model.update((m) => ({ ...m, colorId: '' as GUID }));
    fixture.detectChanges();
    expect(sizeCtrl.excludeIds()).toEqual([]);
  });

  it('limpia la talla si el color cambia y esa talla ya existe', () => {
    const { fixture, modal } = setup();

    modal.model.update((m) => ({ ...m, sizeId: 's42', sizeName: '42' }));
    modal.useColor('c1');
    fixture.detectChanges();

    expect(modal.model().sizeId).toBe('');
    expect(modal.model().sizeName).toBe('');
  });

  it('muestra los precios distintos ordenados, sin duplicados ni nulos', () => {
    const { root } = setup();

    expect(root.textContent).toContain('Precios del producto:');
    expect(chips(root).map((b) => b.textContent?.trim())).toEqual(['Bs 120.00', 'Bs 150.00']);
  });

  it('un tap aplica el precio y resalta el chip', () => {
    const { fixture, modal, root } = setup();

    chips(root)
      .find((b) => b.textContent?.includes('Bs 150.00'))!
      .click();
    fixture.detectChanges();

    expect(modal.model().price).toBe(150);
    const active = chips(root).find((b) => b.textContent?.includes('Bs 150'))!;
    expect(active.classList.contains('!border-accent-ui')).toBe(true);
    expect(active.classList.contains('!text-accent-ui')).toBe(true);
  });

  it('sin precios no muestra la fila', () => {
    const { root } = setup([{ colorId: 'c1', sizeId: 's1', color: 'Rojo', price: null }]);

    expect(root.textContent).not.toContain('Precios del producto:');
    expect(chips(root)).toHaveLength(0);
  });
});
