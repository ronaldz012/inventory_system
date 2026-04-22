
// Define la entidad base
import {BaseQueryDto} from '../base-query-dto';

export interface Category {
  id: number;
  name: string;
  description: string;
}
export interface CategoryQuery extends BaseQueryDto {

}


