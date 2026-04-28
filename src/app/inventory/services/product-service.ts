import {inject, Injectable} from '@angular/core';
import {CreateProductDto} from '../dtos/products/create-product-dto';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {Observable} from 'rxjs';
import {ProductQuery} from '../dtos/products/product-dto';
import {PagedResult} from '../dtos/paged-result';
import {ListProduct} from '../interfaces/listProduct';
import {ProductSearchResult} from '../components/product-search/product-search-result';
import ProductDetail from '../pages/products-page/product-detail/product-detail';
import {ProductDetailDto} from '../dtos/products/product-detail-dto';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private http = inject(HttpClient);
  private url = environment.BACKEND_URL + '/api/Product';

  createProduct(dto : CreateProductDto): Observable<boolean> {
    return  this.http.post<boolean>(this.url, dto);
  }
  getProducts(query : ProductQuery) : Observable<PagedResult<ListProduct>>{
    let params = new HttpParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params = params.set(key, value.toString());
      }
    });
    return this.http.get<PagedResult<ListProduct>>(this.url, {params});
  }
  searchProduct(query :string )
  {
    let params = new HttpParams();
    params = params.set('request', query);
    return this.http.get<ProductSearchResult[]>(this.url+ '/Search', {params});
  }

  getById(number: number) {
    return this.http.get<ProductDetailDto>(this.url + '/' + number);
  }
}
