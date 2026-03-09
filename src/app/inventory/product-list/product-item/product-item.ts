import {Component, input} from '@angular/core';
import {Product} from '../../interfaces/product';

@Component({
  selector: 'app-product-item',
  imports: [],
  templateUrl: './product-item.html',
  styles: ``,
})
export default class ProductItem {
  product = input.required<Product>();
}
