/**
 * Decide si un desplegable debe abrir hacia arriba (flip) según el espacio
 * real en viewport. Evita que la lista nazca tapada por footers sticky u
 * otros elementos (y los misclicks que eso provoca).
 */
export function dropUpFor(el: HTMLElement | null | undefined, needPx = 220): boolean {
  if (!el || typeof window === 'undefined') return false;
  const rect = el.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  if (below >= needPx) return false;
  return rect.top > needPx;
}

/** Altura máxima disponible en la dirección elegida (para no nacer cortada). */
export function dropMaxHeightFor(
  el: HTMLElement | null | undefined,
  dropUp: boolean,
  marginPx = 12,
  capPx = 192,
): number | null {
  if (!el || typeof window === 'undefined') return null;
  const rect = el.getBoundingClientRect();
  const space = dropUp ? rect.top - marginPx : window.innerHeight - rect.bottom - marginPx;
  // Tope fijo (convención: ~7-8 items + scroll) salvo que el espacio real sea menor.
  return Math.min(Math.max(space, 96), capPx);
}
