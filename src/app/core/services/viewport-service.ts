import { Injectable, signal } from '@angular/core';

/**
 * Debe coincidir con el `lg` (1024px) de Tailwind: una sola fuente para
 * "desktop vs mobile" en TS y en CSS.
 */
const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Detección de viewport para MONTAR una u otra variante de un componente
 * (fila desktop vs card mobile) — cada bloque existe una sola vez en el DOM.
 *
 * Reglas de uso:
 * - Para layout trivial (chips, bandas, cabezales) sigue mandando CSS
 *   (`hidden lg:…`): este service no reemplaza los breakpoints, los comparte.
 * - Los componentes que bifurcan con `@if` deben ser presentacionales
 *   (estado en signals del padre): al cruzar el breakpoint el bloque se
 *   destruye y se recrea, y nada debe vivir adentro.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  readonly isDesktop = signal(false);

  constructor() {
    // Defensivo para happy-dom/SSR: sin matchMedia todo queda "mobile".
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    this.isDesktop.set(mq.matches);
    mq.addEventListener('change', (e) => this.isDesktop.set(e.matches));
  }
}
