import {inject, Injectable} from '@angular/core';
import {CategoryQuery} from '../dtos/categories/category-dto';
import {PagedResult} from '../dtos/paged-result';
import {Brand, BrandQuery} from '../dtos/brands/brand-dto';
import {map, Observable} from 'rxjs';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {CreateBrandDto} from '../dtos/brands/create-brand-dto';

@Injectable({
  providedIn: 'root',
})
export class BrandService {
  private  http = inject(HttpClient);
  private url = environment.BACKEND_URL + '/api/Brand';

  GetBrands(query : BrandQuery ): Observable<PagedResult<Brand>>
  {
    let params = new HttpParams()

    Object.entries(query).forEach(([key, value]) => {
      if(value !==null && value !== undefined) {
        params = params.set(key, value.toString());
      }
    })
    return this.http.get<PagedResult<Brand>>(this.url, {params});
  }

  GetAll(): Observable<Brand[]>
  {
    return this.GetBrands({isPaged:false}).pipe(
      map(result => result.items)
    )
  }

  create(newBrand: CreateBrandDto) {
    return this.http.post<Brand>(this.url, newBrand);
  }
}
