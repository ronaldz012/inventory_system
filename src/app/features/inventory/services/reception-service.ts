import { inject, Injectable } from '@angular/core';
import createReceptionDto from '../dtos/receptions/create-reception-dto';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'environments/environment';
import {
  ReceptionQueryParams,
  StockReceptionListDto,
} from '../dtos/receptions/stock-reception-list-dto';
import { PagedResult } from '../dtos/paged-result';
import { StockReceptionDetailDto } from '../dtos/receptions/stock-reception-details-dto';
import { ReceptionLabelsDto } from '../dtos/receptions/reception-labels-dto';
import { StockReceptionRevertCheckDto } from '../dtos/receptions/stock-reception-revert-check-dto';
import { StockReceptionResultDto } from '../dtos/receptions/stock-reception-result-dto';

@Injectable({
  providedIn: 'root',
})
export class ReceptionService {
  private url = `${environment.BACKEND_URL}/api/Reception`;
  private http = inject(HttpClient);
  create(payload: createReceptionDto): Observable<StockReceptionResultDto> {
    return this.http.post<StockReceptionResultDto>(this.url, payload);
  }

  getAll(query: ReceptionQueryParams): Observable<PagedResult<StockReceptionListDto>> {
    let params = new HttpParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params = params.set(key, value.toString());
      }
    });
    return this.http.get<PagedResult<StockReceptionListDto>>(this.url, { params: params });
  }

  checkCanRevert(id: GUID): Observable<StockReceptionRevertCheckDto> {
    return this.http.get<StockReceptionRevertCheckDto>(`${this.url}/${id}/can-revert`);
  }

  rollbackReception(id: GUID): Observable<boolean> {
    return this.http.post<boolean>(`${this.url}/${id}/revert`, null);
  }

  getReceptionDetail(number: GUID) {
    return this.http.get<StockReceptionDetailDto>(this.url + '/' + number);
  }
  getReceptionLabels(id: GUID): Observable<ReceptionLabelsDto> {
    return this.http.get<ReceptionLabelsDto>(this.url + '/' + id + '/labels');
  }
}
