import { TransferDirection, TransferStatus } from "./transfer-enums"

export interface StockTransferDetailDto {
  id:GUID,
  number: number,
  direction: TransferDirection,
  fromBranchName:string,
  toBranchName:string,
  requesterName:string,
  resolverName:string | null,
  status: TransferStatus
  notes: string
  createdAt: Date
  resolvedAt: Date | null
  items: StockTransferItemDetailDto[]
}

export interface StockTransferItemDetailDto
{
  productVariantId: GUID;
  sku  :string;
  productName :string;
  variantDescription  :string;
  size :string;
  color   :string;
  quantityRequested: number
}
