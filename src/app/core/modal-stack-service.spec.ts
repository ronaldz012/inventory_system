import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalStackService, useStackedModal } from './modal-stack-service';
import { modalGuard } from './modal-guard';

describe('ModalStackService', () => {
  function setup() {
    TestBed.configureTestingModule({});
    return TestBed.inject(ModalStackService);
  }

  it('empieza vacía y closeTop en vacía no hace nada', () => {
    const stack = setup();
    expect(stack.isEmpty()).toBe(true);
    expect(stack.closeTop()).toBe(false);
  });

  it('closeTop cierra en orden LIFO y desregistra', () => {
    const stack = setup();
    const closed: string[] = [];
    // Patrón real: el closer se desregistra al cerrar de verdad
    for (const tag of ['l1', 'l2']) {
      let unregister = () => {};
      unregister = stack.push(() => {
        unregister();
        closed.push(tag);
      });
    }
    expect(stack.closeTop()).toBe(true);
    expect(closed).toEqual(['l2']);
    expect(stack.isEmpty()).toBe(false);
    expect(stack.closeTop()).toBe(true);
    expect(closed).toEqual(['l2', 'l1']);
    expect(stack.isEmpty()).toBe(true);
  });

  it('unregister quita sin cerrar (X / destroy)', () => {
    const stack = setup();
    let closed = 0;
    const unregister = stack.push(() => closed++);
    unregister();
    expect(stack.isEmpty()).toBe(true);
    expect(stack.closeTop()).toBe(false);
    expect(closed).toBe(0);
  });
});

describe('useStackedModal', () => {
  function setup(canClose?: () => boolean) {
    TestBed.configureTestingModule({});
    const stack = TestBed.inject(ModalStackService);
    const show = signal(false);
    return { stack, show, modal: useStackedModal(stack, show, canClose) };
  }

  it('open muestra y registra; close oculta y desregistra', () => {
    const { stack, show, modal } = setup();
    modal.open();
    expect(show()).toBe(true);
    expect(stack.isEmpty()).toBe(false);
    modal.close();
    expect(show()).toBe(false);
    expect(stack.isEmpty()).toBe(true);
  });

  it('doble open no duplica la entrada', () => {
    const { stack, modal } = setup();
    modal.open();
    modal.open();
    expect(stack.closeTop()).toBe(true);
    expect(stack.isEmpty()).toBe(true);
  });

  it('canClose falso bloquea y mantiene el registro', () => {
    const { stack, show, modal } = setup(() => false);
    modal.open();
    modal.close();
    expect(show()).toBe(true);
    expect(stack.isEmpty()).toBe(false);
  });

  it('destroy limpia sin cerrar', () => {
    const { stack, show, modal } = setup();
    modal.open();
    modal.destroy();
    expect(show()).toBe(true);
    expect(stack.isEmpty()).toBe(true);
  });
});

describe('modalGuard', () => {
  function setup(trigger: string | null) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: { getCurrentNavigation: () => (trigger ? { trigger } : null) },
        },
      ],
    });
    return TestBed.inject(ModalStackService);
  }

  function runGuard(): boolean {
    return TestBed.runInInjectionContext(() =>
      modalGuard({} as never, {} as never, {} as never, {} as never),
    ) as boolean;
  }

  it('sin modales deja pasar aunque sea popstate', () => {
    setup('popstate');
    expect(runGuard()).toBe(true);
  });

  it('popstate con modal: cierra el tope y cancela', () => {
    const stack = setup('popstate');
    let closed = 0;
    stack.push(() => closed++);
    expect(runGuard()).toBe(false);
    expect(closed).toBe(1);
  });

  it('navegación normal (link) con modal abierto: deja pasar sin cerrar', () => {
    const stack = setup('imperative');
    let closed = 0;
    stack.push(() => closed++);
    expect(runGuard()).toBe(true);
    expect(closed).toBe(0);
  });

  it('closer que no cierra (POST en curso): cancela y la entrada queda', () => {
    const stack = setup('popstate');
    stack.push(() => {});
    expect(runGuard()).toBe(false);
    expect(stack.isEmpty()).toBe(false);
  });
});
