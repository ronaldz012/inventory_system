/**
 * Diccionario ÚNICO de métodos de pago: enum espejo del backend, su traducción
 * a término de UI y su chip. Toda pantalla que muestre un método sale de acá —
 * nada de chips hardcodeados en componentes.
 */
export enum PaymentMethod {
  Cash = 0,
  QrCode = 1,
}

/** Término de UI por método. Métodos futuros sin mapear caen en '—', nunca mienten. */
export function paymentMethodLabel(v: PaymentMethod): string {
  switch (v) {
    case PaymentMethod.Cash:
      return 'Efectivo';
    case PaymentMethod.QrCode:
      return 'QR';
    default:
      return '—';
  }
}

export function isCashPayment(v: PaymentMethod): boolean {
  return v === PaymentMethod.Cash;
}

/** Chip por método: el mismo estilo en detalle, listados, cierre, devoluciones. */
export function paymentMethodChipClass(v: PaymentMethod): string {
  switch (v) {
    case PaymentMethod.QrCode:
      return 'text-xs font-medium text-feedback-info-text bg-feedback-info-bg/10 px-2 py-0.5 rounded-md';
    case PaymentMethod.Cash:
      return 'text-xs font-medium text-text-muted bg-bg-muted px-2 py-0.5 rounded-md';
    default:
      // Método futuro sin chip propio: chip neutro (el label ya muestra '—').
      return 'text-xs font-medium text-text-muted bg-bg-muted px-2 py-0.5 rounded-md';
  }
}
