import {inject, Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {TransferForm} from '../dtos/transfers/transfer-form';
import {Observable} from 'rxjs';
import {environment} from 'environments/environment';
import {StockTransferListDto, TransferQueryParams} from '../dtos/transfers/stock-transfer-list-dto';
import {PagedResult} from '../dtos/paged-result';
import {StockTransferDetailDto} from '../dtos/transfers/stock-transfer-detail-dto';

@Injectable({
  providedIn: 'root',
})
export class TransferService {
  private http = inject(HttpClient);
  private readonly URL:string = environment.BACKEND_URL+'/api/StockTransfer';


  createTransfer(form : TransferForm): Observable<GUID>{
    return this.http.post<GUID>(this.URL, form)
  }

  cancelTransfer(id: GUID) {
    return this.http.patch<boolean>(this.URL+'/Cancel/'+id,{});
  }

  resolveTransfer(id: GUID, action: "complete" | "reject") :Observable<boolean>{
    let accepted = action === "complete";
    return this.http.post<boolean>(this.URL+'/Resolve/'+id, {complete: accepted, notes: ""})
  }

  getTransfers(query: TransferQueryParams):Observable<PagedResult<StockTransferListDto>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params = params.set(key, value.toString());
      }
    });
    return this.http.get<PagedResult<StockTransferListDto>>(this.URL,{params: params})
  }

  getTransferDetail(number: GUID) {
    return this.http.get<StockTransferDetailDto>(this.URL+'/'+number);
  }
}
