import {inject, Injectable} from '@angular/core';
import createReceptionDto from '../interfaces/Dtos/Receptions/create-reception-dto';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '../../../environments/environment';

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
}
