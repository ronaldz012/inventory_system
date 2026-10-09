import { Directive, HostListener } from '@angular/core';
import { shouldBlockNumericKey } from '../utils/list-query';

/**
 * Navegación por teclado en grillas de inputs numéricos (opt-in).
 *
 * Uso:
 * ```html
 * <div appGridNav>
 *   @for (row of rows; track row.id) {
 *     <div data-nav-row>
 *       <input data-nav-field="qty" type="number" ... />
 *       <input data-nav-field="cost" type="number" ... />
 *     </div>
 *   }
 * </div>
 * ```
 *
 * - `ArrowDown`/`ArrowUp` mueven el foco a la misma columna en la fila
 *   vecina (sin fila vecina se queda + preventDefault para no steppear).
 * - `ArrowLeft`/`ArrowRight` mueven el foco entre columnas de la misma fila
 *   (en los bordes se deja el nativo: mueve el caret, inofensivo).
 * - El resto de teclas malas (`-`, `+`, `e`) se bloquean igual que blockNonNumericKeys.
 * - La ruedita del mouse no cambia el valor dentro de la grilla.
 * - Fuera de `[data-nav-field]` no hace nada.
 */
@Directive({
  selector: '[appGridNav]',
  standalone: true,
})
export class GridNavDirective {
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const field = target?.closest?.('[data-nav-field]') as HTMLElement | null;
    if (!field || !event.currentTarget) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const container = event.currentTarget as HTMLElement;
      const rows = Array.from(container.querySelectorAll('[data-nav-row]'));
      const row = field.closest('[data-nav-row]');
      const idx = row ? rows.indexOf(row) : -1;
      const next = rows[idx + (event.key === 'ArrowDown' ? 1 : -1)] as
        | HTMLElement
        | undefined;
      const name = field.getAttribute('data-nav-field');
      const dest = next?.querySelector(`[data-nav-field="${name}"]`) as
        | HTMLInputElement
        | null
        | undefined;
      event.preventDefault();
      dest?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const row = field.closest('[data-nav-row]');
      if (!row) return;
      const fields = Array.from(row.querySelectorAll('[data-nav-field]'));
      const dest = fields[fields.indexOf(field) + (event.key === 'ArrowRight' ? 1 : -1)] as
        | HTMLInputElement
        | undefined;
      // En los bordes se deja el nativo (caret); el steppeo solo existe en ↑↓.
      if (!dest) return;
      event.preventDefault();
      dest.focus();
      return;
    }

    if (shouldBlockNumericKey(event.key)) event.preventDefault();
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('[data-nav-field]')) event.preventDefault();
  }
}
