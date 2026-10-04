import {Gender} from './gender';

// Modelo interno (una etiqueta ya expandida)
export interface LabelData {
  variantId: GUID;
  sku: string;
  productName: string;
  brandName: string;
  size: string;
  color: string;
  gender: Gender;
  price: number;
  receptionId: GUID;
}

export const LABELS_PER_SHEET = 27; // 3 columnas × 6 filas en A4
