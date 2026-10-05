export enum Gender {
  Unisex,
  Hombre,
  Mujer,
}

/**
 * Etiquetas canónicas de género (UI). `Record<Gender, string>` es exhaustivo:
 * si el backend agrega un valor al enum, el build falla hasta actualizarlo.
 * Ojo: `Gender.Unisex === 0`, así que nunca usar truthiness sobre un Gender.
 */
export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.Unisex]: 'Unisex',
  [Gender.Hombre]: 'Hombre',
  [Gender.Mujer]: 'Mujer',
};

/** Opciones para `<select>` de género, en el orden en que se muestran. */
export const GENDER_OPTIONS: readonly { value: Gender; label: string }[] = [
  { value: Gender.Unisex, label: GENDER_LABELS[Gender.Unisex] },
  { value: Gender.Hombre, label: GENDER_LABELS[Gender.Hombre] },
  { value: Gender.Mujer, label: GENDER_LABELS[Gender.Mujer] },
];
