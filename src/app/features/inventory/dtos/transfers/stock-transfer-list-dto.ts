import {BaseQueryDto} from '../base-query-dto';
import { TransferDirection, TransferStatus } from './transfer-enums';

export interface StockTransferListDto {
  id: GUID;
  number: number;
  direction : TransferDirection;
  counterpartBranchName: string;
  requesterName: string;
  status: TransferStatus;
  totalItem: number;
  totalQuantity: number;
  createdAt: Date;
  resolvedAt: Date | null;
}
export interface TransferQueryParams extends BaseQueryDto {
  status?: TransferStatus[];
  direction?: TransferDirection;
  dateFrom?: string;
  dateTo?: string;
}
