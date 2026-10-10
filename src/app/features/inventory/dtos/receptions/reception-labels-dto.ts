import { Gender } from '../../interfaces/gender';

export interface ReceptionLabelItemDto {
  variantId: GUID;
  sku: string;
  size: string;
  color: string;
  gender: Gender;
  price: number;
  productName: string;
  brandName: string;
  categoryName: string;
  quantity: number;
}

export interface ReceptionLabelsDto {
  receptionId: GUID;
  number: number;
  receptionDate: string; // ISO date string
  items: ReceptionLabelItemDto[];
}
