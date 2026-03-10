import {Component, signal} from '@angular/core';
import {Product} from '../../interfaces/product';
import ProductItem from '../../product-list/product-item/product-item';
import {ProductList} from '../../product-list/product-list';

@Component({
  selector: 'app-products',
  imports: [
    ProductList
  ],
  templateUrl: './products.html',
  styles: ``,
})
export default class Products {
  product = signal<Product>({
    id:1,
    name:"Pantalon",
    stock:2,
    price:100,
  });
}
