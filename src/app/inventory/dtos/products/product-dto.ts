import {BaseQueryDto} from '../base-query-dto';

export interface ProductQuery  extends  BaseQueryDto{
  branchId:number;
  categoryId?:number |null;
}
