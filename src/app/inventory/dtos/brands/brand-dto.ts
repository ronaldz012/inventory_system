import {BaseQueryDto} from '../base-query-dto';

export interface Brand {
  id: number;
  name: string;
  description: string;
}
export interface BrandQuery extends BaseQueryDto {

}
