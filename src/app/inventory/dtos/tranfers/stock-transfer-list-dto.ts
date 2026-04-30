import {TransferDirection, TransferStatus} from './transfer-enums';

export interface StockTransferListDto {
  id: number;
  direction : TransferDirection;
  counterpartBranchName: string;
  requesterName: string;
  status: TransferStatus;
  totalItem: number;
  totalQuantity: number;
  createdAt: Date;
  resolvedAt: Date | null;
}
