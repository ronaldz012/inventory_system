import { Component, inject, input, OnInit, output, signal} from '@angular/core';
import {ProductService} from '../../../services/product-service';
import {ProductDetailDto} from '../../../dtos/products/product-detail-dto';
import {UpperCasePipe} from '@angular/common';

const tabs = [
  { key: 'info', label: 'Información' },
  { key: 'variants', label: 'Variantes' },
  { key: 'stock', label: 'Stock' }
] as const;
@Component({
  selector: 'app-product-detail',
  imports: [
    UpperCasePipe
  ],
  templateUrl: './product-detail.html',
  styles: ``,
})
export default class ProductDetail implements OnInit {


  productId = input.required<number>();
  closed = output<void>();

  private productService = inject(ProductService);

  product = signal<ProductDetailDto | null>(null);
  loading = signal(true);
  activeTab = signal<'info' | 'variants' | 'stock'>('info');

  ngOnInit() {
    this.productService.getById(this.productId()).subscribe(p => {
      this.product.set(p);
      this.loading.set(false);
    });
  }

  setTab(tab: 'info' | 'variants' | 'stock') {
    this.activeTab.set(tab);
  }

  close() {
    this.closed.emit();
  }

  protected readonly tabs = tabs;
}
