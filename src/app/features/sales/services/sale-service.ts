import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import { PagedResult } from '@features/inventory/dtos/paged-result';
import { SaleListDto } from '@features/sales/dtos/sale-list-dto';
import { SellerDto } from '@features/sales/dtos/seller-dto';
import { SalesQueryDto } from '@features/sales/dtos/sales-query-dto';
import { SaleDetailDto } from '@features/sales/dtos/sale-detail-dto';
import { CreateSaleDto } from '@features/sales/dtos/create-sale-dto';
import {
  CreateReturnDto,
  CreateReturnResponse,
  SaleForReturnDto,
  SkuSearchResponseDto,
  SkuSearchQuery,
} from '@features/sales/dtos/returns-dto';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private http = inject(HttpClient);
  private baseUrl = environment.BACKEND_URL + '/api/Sale';

  getSales(query: SalesQueryDto): Observable<PagedResult<SaleListDto>> {
    let params = new HttpParams();
    params = params.set('type', query.type.toString());
    if (query.filter) params = params.set('filter', query.filter);
    if (query.soldById) params = params.set('soldById', query.soldById);
    if (query.dateFrom) params = params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params = params.set('dateTo', query.dateTo);
    if (query.returnStatus !== undefined && query.returnStatus !== null)
      params = params.set('returnStatus', query.returnStatus.toString());
    if (query.page) params = params.set('page', query.page);
    if (query.pageSize) params = params.set('pageSize', query.pageSize);
    return this.http.get<PagedResult<SaleListDto>>(this.baseUrl, { params });
  }

  /** Vendedores con ventas en la sucursal, para el filtro del listado. */
  getSellers(): Observable<SellerDto[]> {
    return this.http.get<SellerDto[]>(`${this.baseUrl}/sellers`);
  }

  createSale(dto: CreateSaleDto): Observable<void> {
    return this.http.post<void>(this.baseUrl, dto);
  }

  getSaleDetail(id: GUID): Observable<SaleDetailDto> {
    return this.http.get<SaleDetailDto>(`${this.baseUrl}/${id}/details`);
  }

  searchBySku(query: SkuSearchQuery): Observable<SkuSearchResponseDto> {
    let params = new HttpParams();
    if (query.sku) params = params.set('sku', query.sku);
    if (query.days) params = params.set('days', query.days.toString());
    if (query.page) params = params.set('page', query.page.toString());
    if (query.pageSize) params = params.set('pageSize', query.pageSize.toString());
    return this.http.get<SkuSearchResponseDto>(`${this.baseUrl}/search-by-sku`, {
      params,
    });
  }

  createReturn(saleId: GUID, dto: CreateReturnDto): Observable<CreateReturnResponse> {
    return this.http.post<CreateReturnResponse>(`${this.baseUrl}/${saleId}/returns`, dto);
  }

  getSaleForReturn(saleId: GUID): Observable<SaleForReturnDto> {
    return this.http.get<SaleForReturnDto>(`${this.baseUrl}/${saleId}/returnable`, {});
  }
}
