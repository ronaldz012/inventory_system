import {TransferStatus} from './transfer-enums';

export interface StockTransferDetailDto {

  Id:number,
  FromBranchName:string,
  ToBranchName:string,
  RequesterName:string,
  ResolverName:string | null,
  Status: TransferStatus
 Notes: string
  CreatedAt: Date
 ResolvedAt: Date | null
 Items: StockTransferItemDetailDto[]
}

interface StockTransferItemDetailDto
{
  ProductVariantId: number;
  Sku  :string;
  ProductName :string;
  VariantDescription  :string;
  Size :string;
  Color   :string;
  QuantityRequested: number
}

