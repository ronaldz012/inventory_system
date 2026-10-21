import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  Injector,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProductService } from '@features/inventory/services/product-service';
import { ProductWithVariantsCreatedDto } from '@features/inventory/dtos/products/create-product-with-variants-dto';
import { NewProductModelForm } from '@features/inventory/models/new-product.model';
import {
  ColorGroupForm,
  SizePriceForm,
  buildNewColorGroup,
} from '@features/inventory/models/color-group-form.model';
import {
  applyEach,
  form,
  FormField,
  min,
  minLength,
  required,
  schema,
} from '@angular/forms/signals';
import { BrandSelectCtrl } from '@features/inventory/components/brand-select-crtl/brand-select-crtl.component';
import { CategorySelectCtrl } from '@features/inventory/components/category-select-ctrl/category-select-ctrl.component';
import { GENDER_OPTIONS, Gender } from '@features/inventory/interfaces/gender';
import { ProductSearchResult } from '@features/inventory/components/product-search/product-search-result.component';
import { ToastService } from '@core/services/toast-service';
import { ColorService } from '@features/inventory/services/color-service';
import { SizeService } from '@features/inventory/services/size-service';
import { Size } from '@features/inventory/dtos/sizes/size';
import { blockNonNumericKeys } from '@shared/utils/list-query';
import CreateColorGroup from './create-color-group/create-color-group';

const sizePriceSchema = schema<SizePriceForm>((s) => {
  required(s.price, { message: 'Requerido' });
  min(s.price, 0.5, { message: 'Mín Bs 0.50' });
});

const colorGroupSchema = schema<ColorGroupForm>((g) => {
  required(g.colorId, { message: 'Requerido' });
  minLength(g.sizes, 1, { message: 'Agregá al menos una talla' });
  applyEach(g.sizes, sizePriceSchema);
});

/** Precio por debajo del mínimo aceptado por el backend. */
const MIN_PRICE = 0.5;

@Component({
  selector: 'app-create-product-modal',
  imports: [CreateColorGroup, BrandSelectCtrl, CategorySelectCtrl, FormField],
  templateUrl: './create-product-modal.html',
})
export default class CreateProductModal implements OnInit {
  readonly genderOptions = GENDER_OPTIONS;
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;

  private productService = inject(ProductService);
  private colorService = inject(ColorService);
  private sizeService = inject(SizeService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private readonly injector = inject(Injector);
  /** Contenedor de tarjetas: se usa para llevar la vista a la tarjeta nueva. */
  private readonly cardsList = viewChild<ElementRef<HTMLElement>>('colorCardsList');
  /** Primer campo del flujo: al abrir el panel arranca en categoría. */
  private readonly categorySelect = viewChild(CategorySelectCtrl);
  close = output<void>();
  created = output<ProductSearchResult>();

  returnMode = input(false);

  newProduct = signal<NewProductModelForm>({
    newProduct: {
      name: '',
      description: '',
      categoryId: '',
      categoryName: '',
      brandId: '',
      brandName: '',
      gender: '',
    },
    // Arranca con una tarjeta lista para elegir color.
    colorGroups: [buildNewColorGroup()],
  });

  newProductForm = form(this.newProduct, (s) => {
    required(s.newProduct.name, { message: 'Requerido' });
    required(s.newProduct.brandId, { message: 'Requerido' });
    required(s.newProduct.categoryId, { message: 'Requerido' });
    required(s.newProduct.gender, { message: 'Requerido' });
    minLength(s.colorGroups, 1, { message: 'Agregá al menos un color' });
    applyEach(s.colorGroups, colorGroupSchema);
  });

  isConfirming = signal(false);
  /** Valor de la acción masiva; no forma parte del producto. */
  bulkPrice = signal<number | null>(null);
  error = signal<string | null>(null);

  /** Catálogo de tallas activas, ordenado como lo espera el usuario. */
  sizeCatalog = computed(() =>
    [...this.sizeService.sizes()].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  totalSizes = computed(() =>
    this.newProduct().colorGroups.reduce((total, group) => total + group.sizes.length, 0),
  );

  canApplyBulk = computed(() => {
    const price = this.bulkPrice();
    return price != null && price >= MIN_PRICE && this.totalSizes() > 0;
  });

  summary = computed(() => {
    const groups = this.newProduct().colorGroups;
    if (groups.length === 0) return 'Agregá un color para empezar';

    const sizes = this.totalSizes();
    const parts = [
      `${groups.length} ${groups.length === 1 ? 'color' : 'colores'}`,
      `${sizes} ${sizes === 1 ? 'talla' : 'tallas'}`,
    ];

    const missingColor = groups.filter((group) => !group.colorId).length;
    if (missingColor > 0) {
      parts.push(`${missingColor} sin color`);
    }

    return parts.join(' · ');
  });

  ngOnInit(): void {
    this.colorService.load();
    this.sizeService.load();
    afterNextRender(() => this.categorySelect()?.focus(), { injector: this.injector });
  }

  // ── Colores ──────────────────────────────────────────────────────────────
  /** Colores elegidos en las demás tarjetas: no se vuelven a ofrecer. */
  excludedColorIdsByGroup = computed(() => {
    const groups = this.newProduct().colorGroups;
    return groups.map((_, index) => {
      const ids: GUID[] = [];
      groups.forEach((group, i) => {
        if (i !== index && group.colorId) ids.push(group.colorId);
      });
      return ids;
    });
  });

  addColorGroup(): void {
    this.newProduct.update((current) => ({
      ...current,
      colorGroups: [...current.colorGroups, buildNewColorGroup()],
    }));
    this.scrollToCard(this.newProduct().colorGroups.length - 1);
  }

  /** Copia tallas y precios de una tarjeta; el color queda por elegir. */
  duplicateColorGroup(index: number): void {
    this.newProduct.update((current) => {
      const source = current.colorGroups[index];
      if (!source) return current;
      const groups = [...current.colorGroups];
      groups.splice(index + 1, 0, {
        ...buildNewColorGroup(),
        sizes: source.sizes.map((size) => ({ ...size })),
      });
      return { ...current, colorGroups: groups };
    });
    this.scrollToCard(index + 1);
  }

  removeColorGroup(index: number): void {
    this.newProduct.update((current) => ({
      ...current,
      colorGroups: current.colorGroups.filter((_, i) => i !== index),
    }));
  }

  /** Lleva la vista a la tarjeta recién agregada o duplicada. */
  private scrollToCard(index: number): void {
    afterNextRender(
      () => {
        const card = this.cardsList()?.nativeElement.children.item(index) as HTMLElement | null;
        card?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }

  // ── Tallas ───────────────────────────────────────────────────────────────
  addSize(groupIndex: number, size: Size): void {
    this.newProduct.update((current) => ({
      ...current,
      colorGroups: current.colorGroups.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              sizes: [
                ...group.sizes,
                {
                  sizeId: size.id,
                  sizeName: size.name,
                  price: null,
                },
              ],
            }
          : group,
      ),
    }));
  }

  removeSize(groupIndex: number, sizeIndex: number): void {
    this.newProduct.update((current) => ({
      ...current,
      colorGroups: current.colorGroups.map((group, i) =>
        i === groupIndex
          ? { ...group, sizes: group.sizes.filter((_, j) => j !== sizeIndex) }
          : group,
      ),
    }));
  }

  // ── Precio masivo ────────────────────────────────────────────────────────
  onBulkPriceChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const parsed = parseFloat(value);
    this.bulkPrice.set(isNaN(parsed) ? null : parsed);
  }

  /** Aplica el precio masivo a todas las tallas cargadas. */
  applyBulkPrice(): void {
    const price = this.bulkPrice();
    if (price == null || price < MIN_PRICE) return;
    this.newProduct.update((current) => ({
      ...current,
      colorGroups: current.colorGroups.map((group) => ({
        ...group,
        sizes: group.sizes.map((size) => ({ ...size, price })),
      })),
    }));
  }

  onConfirm(): void {
    this.newProductForm().markAsTouched();
    this.newProductForm().markAsDirty();

    const val = this.newProduct();
    if (this.newProductForm().invalid()) {
      this.error.set('Revisá los campos marcados.');
      return;
    }

    // El POST solo necesita identidad y precio; la respuesta trae el resto.
    const variants = val.colorGroups.flatMap((group) =>
      group.sizes.map((size) => ({
        sizeId: size.sizeId,
        colorId: group.colorId,
        price: size.price!,
      })),
    );

    this.isConfirming.set(true);
    this.error.set(null);

    this.productService
      .createProductWithVariants({
        name: val.newProduct.name,
        description: val.newProduct.description,
        categoryId: val.newProduct.categoryId,
        brandId: val.newProduct.brandId,
        gender: Number(val.newProduct.gender) as Gender,
        variants,
      })
      .subscribe({
        next: (created) => {
          this.isConfirming.set(false);
          this.toastService.success('Producto creado');
          if (this.returnMode()) {
            this.created.emit(this.toSearchResult(created));
            this.close.emit();
            return;
          }
          // Crear es avance: cerrar e ir al detalle con replace (atrás → lista).
          this.close.emit();
          this.router.navigate(['inventory', 'products', created.id, 'detail'], {
            replaceUrl: true,
          });
        },
        error: (err: unknown) => {
          this.isConfirming.set(false);
          const e = err as { error?: { detail?: string; title?: string }; message?: string };
          const msg =
            e?.error?.detail || e?.error?.title || e?.message || 'Error al crear el producto.';
          this.error.set(msg);
        },
      });
  }

  onClose(): void {
    this.close.emit();
  }

  /** La respuesta del POST ya trae todo: solo se renombra la colección. */
  private toSearchResult(created: ProductWithVariantsCreatedDto): ProductSearchResult {
    return {
      id: created.id,
      name: created.name,
      internalCode: created.internalCode,
      description: created.description,
      brandName: created.brandName,
      categoryName: created.categoryName,
      gender: created.gender,
      isActive: created.isActive,
      variantsCount: created.variants.length,
      productVariants: created.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        size: variant.size,
        sizeId: variant.sizeId,
        sizeOrder: variant.sizeOrder,
        colorId: variant.colorId,
        colorName: variant.colorName,
        price: variant.price,
      })),
    };
  }
}
