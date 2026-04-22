import {inject, Injectable} from '@angular/core';
import createReceptionDto from '../dtos/Receptions/create-reception-dto';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';
import {queryReceptions, StockReceptionListDto} from '../dtos/Receptions/stock-reception-list-dto';
import {PagedResult} from '../dtos/paged-result';

@Injectable({
  providedIn: 'root',
})
export class ReceptionService {
  private url = `${environment.BACKEND_URL}/api/Reception`;
  private http = inject(HttpClient)
  create(payload: createReceptionDto): Observable<boolean>
  {
    return this.http.post<boolean>(this.url, payload);
  }

  getReceptions(query: queryReceptions):Observable<PagedResult<StockReceptionListDto>>{

      let params = new HttpParams();

      Object.entries(query).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params = params.set(key, value.toString());
        }
      });
      return this.http.get<PagedResult<StockReceptionListDto>>(this.url, { params:params });
  }
}
