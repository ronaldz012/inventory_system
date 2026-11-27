import { CreateReceptionItemDto } from './create-reception-dto';

/**
 * Edición de una recepción en borrador: FULL-REPLACE — `items` es la lista
 * final completa del borrador (el backend limpia y repone, sin diff).
 * Requiere status Draft; el costo mínimo se valida al confirmar, no acá.
 */
export default interface UpdateDraftDto {
  providerId: GUID;
  notes?: string | null;
  items: CreateReceptionItemDto[];
}
