import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {Category, CategoryQuery} from '../dtos/categories/category-dto';
import {map, Observable} from 'rxjs';
import {PagedResult} from '../dtos/paged-result';
import {CreateCategoryDto} from '../dtos/categories/create-category-dto';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {

private  http = inject(HttpClient);
private url = environment.BACKEND_URL + '/api/Category';


GetCategories(query : CategoryQuery): Observable<PagedResult<Category>>
{
  let params = new HttpParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      params = params.set(key, value.toString());
    }
  });
  return this.http.get<PagedResult<Category>>(this.url, { params });
}

  getAll(): Observable<Category[]> {
    return this.GetCategories({ isPaged: false }).pipe(
      map(result => result.items)
    );
  }


  create(createCategory : CreateCategoryDto): Observable<Category> {
    return this.http.post<Category>(this.url, createCategory);
  }
}
