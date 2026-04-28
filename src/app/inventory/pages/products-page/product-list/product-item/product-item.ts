import {Component, input, output} from '@angular/core';
import {ListProduct} from '../../../../interfaces/listProduct';

@Component({
  selector: 'app-product-item',
  imports: [],
  templateUrl: './product-item.html',
  styles: ``,
})
export default class ProductItem {
  viewDetail = output<number>();
  product = input.required<ListProduct>();
}
