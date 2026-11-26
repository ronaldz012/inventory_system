import { ReceptionStatus } from './stock-reception-list-dto';

/**
 * Respuesta común de create / update / confirm / add-items del backend.
 * Solo se modela lo que la UI consume: `id` y `number` alcanzan para el
 * toast ("Recepción #8"); el resto queda opcional.
 */
export interface StockReceptionResultDto {
  id: GUID;
  number?: number;
  providerName?: string;
  status?: ReceptionStatus;
}
