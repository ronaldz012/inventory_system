import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import TransferDetails from './transfer-details';
import { TransferService } from '../../../services/transfer-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ToastService } from '@core/services/toast-service';
import { ModalStackService } from '@core/modal-stack-service';

@Component({
  standalone: true,
  imports: [TransferDetails],
  template: `<app-transfer-details />`,
})
class Host {}

describe('TransferDetails resolve/cancel flow', () => {
  const calls = { resolve: 0, cancel: 0 };
  const navigateSpy = {
    paths: [] as unknown[][],
    flags: [] as (boolean | undefined)[],
    fn(commands: unknown[], extras?: { replaceUrl?: boolean }) {
      this.paths.push(commands);
      this.flags.push(extras?.replaceUrl);
      return Promise.resolve(true);
    },
  };

  beforeEach(async () => {
    calls.resolve = 0;
    calls.cancel = 0;
    navigateSpy.paths = [];
    navigateSpy.flags = [];
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 't1' } } } },
        { provide: Router, useValue: { navigate: (...a: unknown[]) => navigateSpy.fn(a[0] as unknown[], a[1] as never) } },
        {
          provide: TransferService,
          useValue: {
            getTransferDetail: () => of({ id: 't1', items: [] }),
            resolveTransfer: () => {
              calls.resolve++;
              return of(true);
            },
            cancelTransfer: () => {
              calls.cancel++;
              return of(true);
            },
          },
        },
        { provide: PermissionService, useValue: { can: () => true } },
        { provide: ToastService, useValue: { error: () => {}, success: () => {} } },
      ],
    }).compileComponents();
  });

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const page = fixture.debugElement.children[0].componentInstance as TransferDetails;
    let goBackCalls = 0;
    page.goBack = () => {
      goBackCalls++;
    };
    return { fixture, page, goBackCalls: () => goBackCalls };
  }

  it('openResolveModal abre por signal y lo registra en la pila', () => {
    const { page } = setup();
    const stack = TestBed.inject(ModalStackService);
    page.openResolveModal();
    expect(page.showResolveModal()).toBe(true);
    expect(stack.isEmpty()).toBe(false);
    expect(navigateSpy.paths).toEqual([]);
  });

  it('completar cierra, vuelve al origen con goBack y no deja el modal para el atrás', () => {
    const { page, goBackCalls } = setup();
    const stack = TestBed.inject(ModalStackService);
    page.openResolveModal();
    page.onResolveConfirm('complete');
    expect(calls.resolve).toBe(1);
    expect(page.showResolveModal()).toBe(false);
    expect(stack.isEmpty()).toBe(true);
    // Retorno al origen (colapsa el detalle): cero navigates directos
    expect(goBackCalls()).toBe(1);
    expect(navigateSpy.paths).toEqual([]);
  });

  it('closeTop con el modal abierto lo cierra sin navegar (atrás del sistema)', () => {
    const { page } = setup();
    const stack = TestBed.inject(ModalStackService);
    page.openCancelModal();
    expect(stack.closeTop()).toBe(true);
    expect(page.showCancelModal()).toBe(false);
    expect(navigateSpy.paths).toEqual([]);
    expect(calls.cancel).toBe(0);
  });

  it('cancelar vuelve al origen con goBack (sin navegar directo)', () => {
    const { page, goBackCalls } = setup();
    page.openCancelModal();
    page.onCancelConfirm();
    expect(calls.cancel).toBe(1);
    expect(page.showCancelModal()).toBe(false);
    expect(goBackCalls()).toBe(1);
    expect(navigateSpy.paths).toEqual([]);
  });
});
