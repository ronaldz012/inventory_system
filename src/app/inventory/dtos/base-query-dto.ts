export interface BaseQueryDto {
  isPaged: boolean;
  page?: number;
  pageSize?: number;
  filter?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  fieldValue?: string;
  fieldName?: string;
}
