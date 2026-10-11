import { Injectable, WritableSignal } from '@angular/core';

/** Cierra el modal del tope. Si no puede cerrar (ej. POST en curso), no hace nada. */
export type ModalCloser = () => void;

/**
 * Pila de modales abiertos por signals (L1/L2/L3, sin URL ni historial).
 * El atrás del sistema cierra solo el tope: cada closer decide si puede
 * cerrar y se desregistra al hacerlo (si no cierra, la entrada queda y el
 * próximo atrás reintenta).
 */
@Injectable({ providedIn: 'root' })
export class ModalStackService {
  private readonly stack: ModalCloser[] = [];

  /**
   * Registra el closer al abrir el modal. Devuelve el unregister: llamarlo
   * al cerrar y en `ngOnDestroy` (las vistas destruidas no dejan entradas).
   */
  push(closer: ModalCloser): () => void {
    this.stack.push(closer);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const i = this.stack.indexOf(closer);
      if (i >= 0) this.stack.splice(i, 1);
    };
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  /**
   * Cierra el tope sin sacarlo antes (peek): si el closer no cierra, la
   * entrada queda para el próximo intento.
   */
  closeTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    if (!top) return false;
    top();
    return true;
  }
}

export interface StackedModal {
  open(): void;
  close(): void;
  destroy(): void;
}

/**
 * Conecta un modal por signal a la pila (mecanismo único; la política de
 * cuándo abrir/cerrar queda en la vista). `canClose` bloquea el cierre
 * (ej. POST en curso): el closer queda registrado y el próximo atrás reintenta.
 * Llamar `destroy()` en `ngOnDestroy`.
 */
export function useStackedModal(
  stack: ModalStackService,
  show: WritableSignal<boolean>,
  canClose: () => boolean = () => true,
): StackedModal {
  let unregister = () => {};
  const modal: StackedModal = {
    open(): void {
      if (show()) return;
      show.set(true);
      unregister = stack.push(() => modal.close());
    },
    close(): void {
      if (!canClose()) return;
      unregister();
      show.set(false);
    },
    destroy(): void {
      unregister();
    },
  };
  return modal;
}
