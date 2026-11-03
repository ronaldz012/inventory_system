import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FreeItemDraft, PosFreeItemModal } from './pos-free-item-modal';

describe('PosFreeItemModal', () => {
  async function setup(): Promise<{
    fixture: ComponentFixture<PosFreeItemModal>;
    modal: PosFreeItemModal;
  }> {
    await TestBed.configureTestingModule({ imports: [PosFreeItemModal] }).compileComponents();
    const fixture = TestBed.createComponent(PosFreeItemModal);
    fixture.detectChanges();
    return { fixture, modal: fixture.componentInstance };
  }

  it('enfoca la descripción al abrir para tipear directo', async () => {
    const { fixture } = await setup();
    await fixture.whenStable();

    const input = (fixture.nativeElement as HTMLElement).querySelector('#free-item-description');
    expect(document.activeElement).toBe(input);
  });

  it('no emite mientras las validaciones no pasan', async () => {
    const { modal } = await setup();
    const saved: FreeItemDraft[] = [];
    modal.saved.subscribe((d) => saved.push(d));

    modal.onSave();
    expect(saved).toHaveLength(0);
    expect(modal.submitted()).toBe(true);

    modal.description.set('Pantalon diesel');
    modal.unitPrice.set(0.4);
    modal.onSave();
    expect(saved).toHaveLength(0);

    modal.unitPrice.set(45);
    modal.quantity.set(0);
    modal.onSave();
    expect(saved).toHaveLength(0);
  });

  it('emite la descripción recortada, cantidad y precio', async () => {
    const { modal } = await setup();
    const saved: FreeItemDraft[] = [];
    modal.saved.subscribe((d) => saved.push(d));

    modal.description.set('  Pantalon diesel slim  ');
    modal.quantity.set(2);
    modal.unitPrice.set(45);
    modal.onSave();

    expect(saved).toEqual([{ description: 'Pantalon diesel slim', quantity: 2, unitPrice: 45 }]);
  });

  it('calcula el subtotal cantidad × precio', async () => {
    const { modal } = await setup();
    modal.quantity.set(3);
    modal.unitPrice.set(12.5);

    expect(modal.subtotal()).toBe(37.5);
  });
});
