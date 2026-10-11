import { inject } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';
import { ModalStackService } from './modal-stack-service';

/**
 * Atrás del sistema con modal abierto: cierra solo el tope de la pila y
 * cancela (te quedás en la página). Todo lo demás (links, logout,
 * completes) pasa libre. Sin modales abiertos, deja pasar.
 * Uso: `canDeactivate: [modalGuard]` en la ruta de la vista.
 * Requiere `canceledNavigationResolution: 'computed'` (app.config) para
 * restaurar el pop cancelado sin reescribir entradas del historial.
 */
export const modalGuard: CanDeactivateFn<unknown> = () => {
  if (inject(Router).getCurrentNavigation()?.trigger !== 'popstate') return true;
  return !inject(ModalStackService).closeTop();
};
