import {Component, inject, OnInit, signal} from '@angular/core';
import {ListProduct} from '../../interfaces/listProduct';
import ProductItem from './product-list/product-item/product-item';
import {ProductList} from './product-list/product-list';
import {ProductForm} from './product-form/product-form';
import {CategoryService} from '../../services/category-service';
import {Category} from '../../dtos/categories/category-dto';
import {Brand} from '../../dtos/brands/brand-dto';
import {ProductService} from '../../services/product-service';
import {ProductQuery} from '../../dtos/products/product-dto';
import ProductFilters from './product-filters/product-filters';
import {BrandService} from '../../services/brand-service';



@Component({
  selector: 'app-products-page',
  imports: [
    ProductList, ProductForm, ProductFilters
  ],
  templateUrl: './products-page.html',
  styles: ``,
})
export default class ProductsPage implements OnInit {
  categories = signal<Category[]>([]);
  brands = signal<Brand[]>([]);
  products = signal<ListProduct[]>([]);
  query = signal<ProductQuery>({
    branchId: 1,
    isPaged:true,
    pageSize:20,
    page:1
  });

  private categoryService = inject(CategoryService);
  private brandService = inject(BrandService);
  private productService = inject(ProductService);
  ngOnInit(): void {
    this.categoryService.getAll().subscribe(c => this.categories.set(c));
    this.brandService.GetAll().subscribe(b => this.brands.set(b));
    this.productService.getProducts(this.query()).subscribe(p => this.products.set(p.items))
  }


  showForm = signal(false);
  onProductSave()
  {
    this.productService.getProducts(this.query()).subscribe(p => this.products.set(p.items))
    this.showForm.set(false)
  }

  onFiltersChange(filters: Partial<ProductQuery>)
  {
    this.query.update(q => ({ ...q, ...filters, page: 1 }));
    this.productService.getProducts(this.query()).subscribe(p => this.products.set(p.items))
  }
}
