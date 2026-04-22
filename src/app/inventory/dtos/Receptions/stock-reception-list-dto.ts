import {BaseQueryDto} from '../base-query-dto';

export interface StockReceptionListDto {
  id: number;
  branchId: number;
  receivedAt: string;
  notes: string;
  status: string;
  totalItems: number;
  totalCost: number;
  types: Record<string, string[]>;
}
export interface queryReceptions extends BaseQueryDto {

}
