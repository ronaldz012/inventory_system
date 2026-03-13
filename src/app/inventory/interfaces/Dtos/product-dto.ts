import {BaseQueryDto} from './base-query-dto';

export interface ProductQuery  extends  BaseQueryDto{
  branchId:number;
  brandId?:number |null;
  categoryId?:number |null;
}
