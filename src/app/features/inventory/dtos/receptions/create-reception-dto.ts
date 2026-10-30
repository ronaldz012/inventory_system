export default interface CreateReceptionDto {
  notes?: string;
  providerId: GUID;
  /** true = queda como borrador (no mueve stock ni exige costo mínimo). */
  saveAsDraft?: boolean;
  items: CreateReceptionItemDto[];
}

export interface CreateReceptionItemDto {
  productVariantId: string;
  quantityReceived: number;
  unitCost: number;
}
