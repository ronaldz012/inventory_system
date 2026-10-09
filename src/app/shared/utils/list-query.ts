import { ActivatedRoute, ParamMap, Router } from '@angular/router';

export type QueryValue = string | number | boolean | undefined | null;

/** QueryParams → objeto plano. Tolera `null` (aún sin queryParams). */
export function readQuery(params: ParamMap | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  params?.keys.forEach((key) => {
    const value = params.get(key);
    if (value !== null) out[key] = value;
  });
  return out;
}

export function writeQuery(
  router: Router,
  route: ActivatedRoute,
  query: Record<string, QueryValue>,
): void {
  router.navigate([], {
    relativeTo: route,
    queryParams: query,
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

export function asNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function asOptionalBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === 'true' || value === '1';
}

export function asEnum<T extends number>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return (allowed as readonly number[]).includes(parsed) ? (parsed as T) : fallback;
}

/** `''` → undefined (para no escribir params vacíos). */
export function asOptionalString(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

/**
 * Texto crudo de un input numérico → número o null.
 * Normaliza la coma decimal (`12,50` → 12.5) y trata como vacío todo lo que no
 * sea un número válido no-negativo (letras, `-`, `e`, etc.). El `null` deja que
 * la validación existente (`required`/`min`) haga su trabajo.
 */
export function parseAmountInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '' || /[eE]/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Teclas que nunca tienen sentido en cantidades/montos:
 * - `-`, `+`, `e` (notación y negativos; por pegado entran igual y los frena parseAmountInput).
 * - `ArrowUp`/`ArrowDown`: en un `type=number` solo steppean el valor
 *   (1 + abajo = 0 por error). El caret se mueve con Left/Right, intactas.
 *   Excepción: dentro de `[appGridNav]` las flechas navegan entre filas
 *   (la directiva las intercepta antes y nunca llegan acá como step).
 */
const BLOCKED_NUMERIC_KEYS = new Set(['-', '+', 'e', 'E', 'ArrowUp', 'ArrowDown']);

/** ¿Debe frenarse esta tecla en un input numérico? (la usa blockNonNumericKeys y appGridNav). */
export function shouldBlockNumericKey(key: string): boolean {
  return BLOCKED_NUMERIC_KEYS.has(key);
}

/** Para `(keydown)` en inputs numéricos: frena la tecla en el acto. */
export function blockNonNumericKeys(event: KeyboardEvent): void {
  if (shouldBlockNumericKey(event.key)) event.preventDefault();
}
