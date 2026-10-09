import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '@features/inventory/services/product-service';
import CreateVariantRow from './create-variant-row/create-variant-row';
import { ProductWithVariantsCreatedDto } from '@features/inventory/dtos/products/create-product-with-variants-dto';
import { NewProductModelForm } from '@features/inventory/models/new-product.model';
import {
  applyEach,
  form,
  FormField,
  min,
  required,
  schema,
  validateTree,
} from '@angular/forms/signals';
import { buildNewVariant, VariantForm } from '@features/inventory/models/variant-form.model';
import { BrandSelectCtrl } from '@features/inventory/components/brand-select-crtl/brand-select-crtl.component';
import { CategorySelectCtrl } from '@features/inventory/components/category-select-ctrl/category-select-ctrl.component';
import { GENDER_OPTIONS, Gender } from '@features/inventory/interfaces/gender';
import { ProductSearchResult } from '@features/inventory/components/product-search/product-search-result.component';
import { ToastService } from '@core/services/toast-service';
import { ColorService } from '@features/inventory/services/color-service';
import { blockNonNumericKeys } from '@shared/utils/list-query';
import { closeModal } from '@shared/utils/modal-query';

const createVariantSchema = schema<VariantForm>((v) => {
  required(v.sizeId, { message: 'Requerido' });
  required(v.colorId, { message: 'Requerido' });
  required(v.price, { message: 'Requerido' });
  min(v.price, 0.5, { message: 'Mín Bs 0.50' });
});

@Component({
  selector: 'app-create-product-modal',
  imports: [CreateVariantRow, BrandSelectCtrl, CategorySelectCtrl, FormField],
  templateUrl: './create-product-modal.html',
})
export default class CreateProductModal implements OnInit {
  readonly genderOptions = GENDER_OPTIONS;
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;

  private productService = inject(ProductService);
  private colorService = inject(ColorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);
  close = output<void>();
  created = output<ProductSearchResult>();

  returnMode = input(false);
  initialName = input('');

  newProduct = signal<NewProductModelForm>({
    newProduct: {
      name: '',
      description: '',
      categoryId: '',
      categoryName: '',
      brandId: '',
      brandName: '',
      gender: null,
    },
    variants: [],
    defaultPrice: null,
  });

  newProductForm = form(this.newProduct, (s) => {
    required(s.newProduct.name, { message: 'Requerido' });
    required(s.newProduct.brandId, { message: 'Requerido' });
    required(s.newProduct.categoryId, { message: 'Requerido' });
    required(s.newProduct.gender, { message: 'Requerido' });
    applyEach(s.variants, createVariantSchema);

    validateTree(s.variants, ({ value, fieldTree }) => {
      const variants = value() || [];
      const seen = new Map<string, number[]>();

      variants.forEach((v, i) => {
        if (v.sizeId === null || v.sizeId === undefined || v.sizeId === '') return;
        const colorId = (v.colorId ?? '').trim().toLowerCase();
        if (!colorId) return;
        const key = `${colorId}__${v.sizeId}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(i);
      });

      const errors: { kind: string; message: string; fieldTree: (typeof fieldTree)[number] }[] = [];

      for (const [key, indices] of seen.entries()) {
        if (indices.length > 1) {
          for (const i of indices) {
            errors.push({
              kind: 'duplicateVariant',
              message: 'La combinación de color y talla ya existe',
              fieldTree: fieldTree[i],
            });
          }
        }
      }

      return errors.length > 0 ? errors : null;
    });
  });

  isConfirming = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    // El select de color de cada talla/color lee ColorService pero no lo carga.
    this.colorService.load();
    if (this.initialName()) {
      this.newProduct.update((current) => ({
        ...current,
        newProduct: { ...current.newProduct, name: this.initialName() },
      }));
    }
  }

  addVariant(): void {
    this.newProduct.update((current) => {
      const newVar = buildNewVariant();
      if (current.defaultPrice != null) {
        newVar.price = current.defaultPrice;
      }
      return {
        ...current,
        variants: [...current.variants, newVar],
      };
    });
  }

  /** Duplica la última fila heredando color y precio; solo falta elegir la talla. */
  duplicateLastVariant(): void {
    this.newProduct.update((current) => {
      const last = current.variants[current.variants.length - 1];
      if (!last) return current;
      return {
        ...current,
        variants: [
          ...current.variants,
          {
            ...buildNewVariant(),
            colorId: last.colorId,
            price: last.price ?? current.defaultPrice,
          },
        ],
      };
    });
  }

  /** "Agregar otro Azul" según el color de la última fila; fallback genérico. */
  duplicateLabel = computed(() => {
    const variants = this.newProduct().variants;
    const last = variants[variants.length - 1];
    const name = last
      ? (this.colorService.colors().find((c) => c.id === last.colorId)?.name ?? '').trim()
      : '';
    return name ? `+ Agregar otro ${name}` : '⧉ Duplicar última';
  });

  removeVariant(index: number): void {
    this.newProduct.update((current) => ({
      ...current,
      variants: current.variants.filter((_, i) => i !== index),
    }));
  }

  /** Default para filas nuevas: solo guarda, nunca toca las filas existentes. */
  onDefaultPriceChange(value: string): void {
    const parsed = parseFloat(value);
    this.newProduct.update((current) => ({
      ...current,
      defaultPrice: isNaN(parsed) ? null : parsed,
    }));
  }

  /** Masivo explícito: iguala todas las filas al default (nada si está vacío). */
  applyDefaultToAll(): void {
    this.newProduct.update((current) => {
      if (current.defaultPrice == null) return current;
      return {
        ...current,
        variants: current.variants.map((v) => ({ ...v, price: current.defaultPrice })),
      };
    });
  }

  onConfirm(): void {
    this.newProductForm().markAsTouched();
    this.newProductForm().markAsDirty();
    if (this.newProductForm().invalid() || !this.newProduct().variants.length) return;

    const val = this.newProduct();
    const variants = val.variants;

    this.isConfirming.set(true);
    this.error.set(null);

    this.productService
      .createProductWithVariants({
        name: val.newProduct.name,
        description: val.newProduct.description,
        categoryId: val.newProduct.categoryId,
        brandId: val.newProduct.brandId,
        gender: val.newProduct.gender ?? 0,
        variants: variants.map((v) => ({
          sizeId: v.sizeId,
          colorId: v.colorId,
          price: v.price ?? 0,
        })),
      })
      .subscribe({
        next: (created) => {
          this.isConfirming.set(false);
          this.toastService.success('Producto creado');
          if (this.returnMode()) {
            this.created.emit(this.buildSearchResult(created, val));
            this.close.emit();
            return;
          }
          // El modal vive en la URL (?modal=create): si no lo limpiamos antes de
          // navegar, "atrás" desde el detalle lo reabre con datos viejos.
          closeModal(this.router, this.route);
          this.router.navigate(['inventory', 'products', created.id, 'detail']);
        },
        error: (err: unknown) => {
          this.isConfirming.set(false);
          const e = err as { error?: { detail?: string; title?: string }; message?: string };
          const msg =
            e?.error?.detail || e?.error?.title || e?.message || 'Error al crear el producto.';
          this.toastService.error(msg);
          this.error.set(msg);
        },
      });
  }

  onClose(): void {
    this.close.emit();
  }

  private buildSearchResult(
    created: ProductWithVariantsCreatedDto,
    val: NewProductModelForm,
  ): ProductSearchResult {
    return {
      id: created.id,
      name: created.name,
      internalCode: created.internalCode,
      description: val.newProduct.description,
      basePrice: val.variants[0]?.price ?? 0,
      brandName: created.brandName,
      categoryName: created.categoryName,
      gender: val.newProduct.gender ?? Gender.Unisex,
      productVariants: created.variants.map((cv, i) => ({
        id: cv.productVariantId,
        sku: cv.sku,
        size: cv.size,
        sizeId: val.variants[i]?.sizeId ?? ('' as GUID),
        colorId: val.variants[i]?.colorId ?? ('' as GUID),
        colorName: cv.colorName,
        price: val.variants[i]?.price ?? 0,
      })),
    };
  }

  onGenderChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.newProduct.update((m) => ({
      ...m,
      newProduct: { ...m.newProduct, gender: value },
    }));
  }
}
