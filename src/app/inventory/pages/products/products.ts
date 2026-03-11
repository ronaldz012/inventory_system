import {Component, signal} from '@angular/core';
import {Product} from '../../interfaces/product';
import ProductItem from '../../components/product-list/product-item/product-item';
import {ProductList} from '../../components/product-list/product-list';
import {ProductForm} from '../../components/product-form/product-form';

@Component({
  selector: 'app-products',
  imports: [
    ProductList, ProductForm
  ],
  templateUrl: './products.html',
  styles: ``,
})
export default class Products {
  showForm = signal(false);

  product = signal<Product>({
    id:1,
    name:"Pantalon",
    stock:2,
    price:100,
  });
}
