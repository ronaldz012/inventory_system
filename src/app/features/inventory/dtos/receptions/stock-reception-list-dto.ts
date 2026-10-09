import { BaseQueryDto } from '../base-query-dto';

export interface StockReceptionListDto {
  id: GUID;
  number: number;
  branchId: number;
  providerId: GUID;
  providerName: string;
  receivedAt: Date;
  canRollback: boolean;
  status: ReceptionStatus;
  totalItems: number;
  productVariantsCount: number;
  totalCost: number;
  brandNames: string[];
  categoryNames: string[];
}
export interface ReceptionQueryParams extends BaseQueryDto {
  dateFrom?: string;
  dateTo?: string;
  status?: ReceptionStatus;
  brandId?: GUID;
}
// reception-enums.ts
export enum ReceptionStatus {
  Borrador = 0,
  Confirmado = 1,
  Rechazado = 2,
  Revertida = 3,
}
