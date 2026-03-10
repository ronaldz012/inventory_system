import {Component, signal} from '@angular/core';
import ProductItem from './product-item/product-item';
import {Product} from '../interfaces/product';

@Component({
  selector: 'app-product-list',
  imports: [
    ProductItem
  ],
  templateUrl: './product-list.html',
  styles: ``,
})
export class ProductList {
  productsList = signal<Product[]>([
    {
      id: 2,
      name: "PANTALON MUJER TALLA 43",
      price: 100,
      stock: 2
    },
    {
      id: 3,
      name: "CHAQUETA",
      price: 120,
      stock: 2
    },
  ]);

  // this module will list the product paginated a all good
}
