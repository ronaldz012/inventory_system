import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import AddVariantModal from './add-variant-modal';
import { ColorService } from '@features/inventory/services/color-service';
import { SizeService } from '@features/inventory/services/size-service';

const variants = [
  { colorId: 'c1', sizeId: 's42', price: 120 },
  { colorId: 'c2', sizeId: 's44', price: 150 },
  { colorId: 'c1', sizeId: 's46', price: 120 },
  { colorId: 'c3', sizeId: 's48', price: null },
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

  it('muestra los precios distintos ordenados, sin duplicados ni nulos', () => {
    const { root } = setup();

    expect(root.textContent).toContain('Precios del producto:');
    expect(chips(root).map((b) => b.textContent?.trim())).toEqual(['Bs 120', 'Bs 150']);
  });

  it('un tap aplica el precio y resalta el chip', () => {
    const { fixture, modal, root } = setup();

    chips(root)
      .find((b) => b.textContent?.includes('Bs 150'))!
      .click();
    fixture.detectChanges();

    expect(modal.model().price).toBe(150);
    const active = chips(root).find((b) => b.textContent?.includes('Bs 150'))!;
    expect(active.classList.contains('!border-accent-ui')).toBe(true);
    expect(active.classList.contains('!text-accent-ui')).toBe(true);
  });

  it('sin precios no muestra la fila', () => {
    const { root } = setup([{ colorId: 'c1', sizeId: 's1', price: null }]);

    expect(root.textContent).not.toContain('Precios del producto:');
    expect(chips(root)).toHaveLength(0);
  });
});
