import { Gender } from '../../interfaces/gender';
import { BaseQueryDto } from '../base-query-dto';
import {
  asEnum,
  asNumber,
  asOptionalBool,
  asOptionalString,
  QueryValue,
} from '@shared/utils/list-query';

export enum ProductSortBy {
  CreatedAt = 0,
  Stock = 1,
}

export interface ProductQueryParams extends BaseQueryDto {
  filter?: string;
  categoryId?: GUID;
  brandId?: GUID;
  gender?: Gender;
  includeInactive?: boolean;
  sortBy?: ProductSortBy;
  sortDescending?: boolean;
}

export const PRODUCT_SORT_VALUES: readonly ProductSortBy[] = [
  ProductSortBy.CreatedAt,
  ProductSortBy.Stock,
];

export const GENDER_VALUES: readonly Gender[] = [Gender.Unisex, Gender.Hombre, Gender.Mujer];

/** Defaults del listado (se omiten de la URL cuando coinciden). */
export const PRODUCT_QUERY_DEFAULTS: Required<
  Pick<ProductQueryParams, 'page' | 'pageSize' | 'sortBy' | 'sortDescending'>
> = {
  page: 1,
  pageSize: 10,
  sortBy: ProductSortBy.CreatedAt,
  sortDescending: true,
};

export function parseProductQuery(raw: Record<string, string>): ProductQueryParams {
  return {
    filter: asOptionalString(raw['filter']),
    categoryId: asOptionalString(raw['categoryId']),
    brandId: asOptionalString(raw['brandId']),
    gender:
      raw['gender'] === undefined ? undefined : asEnum(raw['gender'], GENDER_VALUES, Gender.Unisex),
    includeInactive: asOptionalBool(raw['includeInactive']),
    sortBy: asEnum(raw['sortBy'], PRODUCT_SORT_VALUES, PRODUCT_QUERY_DEFAULTS.sortBy),
    sortDescending: asOptionalBool(raw['sortDescending']) ?? PRODUCT_QUERY_DEFAULTS.sortDescending,
    page: asNumber(raw['page'], PRODUCT_QUERY_DEFAULTS.page),
    pageSize: asNumber(raw['pageSize'], PRODUCT_QUERY_DEFAULTS.pageSize),
  };
}


export type ProductQueryStrings = {
  filter?: string;
  categoryId?: GUID;
  brandId?: GUID;
  gender?: Gender;
  includeInactive?: boolean;
  sortBy?: ProductSortBy;
  sortDescending?: boolean;
  page?: number;
  pageSize?: number;
};

/** Params de la consulta → query string, omitiendo los defaults. */
export function serializeProductQuery(q: ProductQueryParams): ProductQueryStrings {
  const isDefaultSort = q.sortBy === undefined || q.sortBy === ProductSortBy.CreatedAt;
  return {
    filter: q.filter || undefined,
    categoryId: q.categoryId,
    brandId: q.brandId,
    gender: q.gender,
    includeInactive: q.includeInactive ? true : undefined,
    // Si no se ordena por stock, la dirección es el default y no se escribe.
    sortBy: isDefaultSort ? undefined : q.sortBy,
    sortDescending: isDefaultSort ? undefined : q.sortDescending,
    page: q.page && q.page > PRODUCT_QUERY_DEFAULTS.page ? q.page : undefined,
    pageSize: q.pageSize && q.pageSize !== PRODUCT_QUERY_DEFAULTS.pageSize ? q.pageSize : undefined,
  };
}

export function sameProductQuery(a: ProductQueryParams, b: ProductQueryParams): boolean {
  return (
    a.filter === b.filter &&
    a.categoryId === b.categoryId &&
    a.brandId === b.brandId &&
    a.gender === b.gender &&
    a.includeInactive === b.includeInactive &&
    a.sortBy === b.sortBy &&
    a.sortDescending === b.sortDescending &&
    a.page === b.page &&
    a.pageSize === b.pageSize
  );
}
