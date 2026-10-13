import { formatNumber } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

/**
 * Formato único de dinero: siempre 2 decimales, sin símbolo por defecto.
 * El símbolo no va inline en tablas (el header lleva el Bs); para totales
 * sueltos usar `| money: 'symbol'`.
 * Regla visual: toda cifra de dinero lleva además `font-mono` (tabular).
 */
export function formatMoney(
  value: number | null | undefined,
  locale: string,
  symbol = false,
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const n = formatNumber(value, locale, '1.2-2');
  return symbol ? `Bs ${n}` : n;
}

@Pipe({
  name: 'money',
  standalone: true,
})
export class MoneyPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: number | null | undefined, mode?: 'symbol'): string {
    return formatMoney(value, this.locale, mode === 'symbol');
  }
}
