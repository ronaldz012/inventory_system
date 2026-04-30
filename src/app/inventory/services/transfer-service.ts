// @ts-ignore

import {inject, Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {TransferForm} from '../dtos/tranfers/transfer-form';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';
import {StockTransferListDto} from '../dtos/tranfers/stock-transfer-list-dto';
import {PagedResult} from '../dtos/paged-result';

@Injectable({
  providedIn: 'root',
})
export class TransferService {
  private http = inject(HttpClient);
  private readonly URL:string = environment.BACKEND_URL+'/api/StockTransfer';


  createTransfer(form : TransferForm): Observable<boolean>{
    return this.http.post<boolean>(this.URL, form)
  }

  cancelTransfer(id: number) {
    return this.http.patch<boolean>(this.URL, id, {})
  }

  resolveTransfer(id: number, action: "complete" | "reject") :Observable<boolean>{
    return this.http.patch<boolean>(this.URL, id, {})
  }

  getTransfers():Observable<PagedResult<StockTransferListDto>> {
    //let params = new HttpParams();
    return this.http.get<PagedResult<StockTransferListDto>>(this.URL)
  }
}
