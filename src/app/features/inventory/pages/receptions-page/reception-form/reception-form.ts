import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, required } from '@angular/forms/signals';
import { ReceptionItem } from './reception-item/reception-item';
import { ReceptionConfirmModal } from './reception-confirm-modal';
import CatalogueItemModal from '../catalogue-item-modal/catalogue-item-modal';
import CreateProductModal from '../../products-page/create-product-modal/create-product-modal';
import CreateReceptionDto from '@features/inventory/dtos/receptions/create-reception-dto';
import { ReceptionService } from '@features/inventory/services/reception-service';
import { ColorService } from '@features/inventory/services/color-service';
import { BrandService } from '@features/inventory/services/brand-service';
import { CategoryService } from '@features/inventory/services/category-service';
import { ProviderService } from '@features/inventory/services/provider-service';
import { ItemForm, Reception, VariantForm } from '@features/inventory/models/variant-form.model';
import { ProductSearchResult } from '@features/inventory/components/product-search/product-search-result.component';
import ProviderSelectCtrl from '@features/inventory/components/provider-select-ctrl/provider-select-ctrl';
import { ToastService } from '@core/services/toast-service';
import { ModalStackService, useStackedModal } from '@core/modal-stack-service';
import { BranchContextService } from '@core/services/branch-context-service';

@Component({
  selector: 'app-reception-form',
  imports: [
    ReceptionItem,
    CurrencyPipe,
    CatalogueItemModal,
    CreateProductModal,
    ProviderSelectCtrl,
    ReceptionConfirmModal,
  ],
  templateUrl: './reception-form.html',
})
export default class ReceptionForm implements OnInit, OnDestroy {
  ngOnInit(): void {
    this.categoryService.load();
    this.colorService.load();
    this.brandService.load();
    this.providerService.load();
  }

  ngOnDestroy(): void {
    this.catalogueModal.destroy();
    this.editModal.destroy();
    this.productModal.destroy();
    this.confirmModal.destroy();
  }

  private receptionService = inject(ReceptionService);
  private categoryService = inject(CategoryService);
  private colorService = inject(ColorService);
  private brandService = inject(BrandService);
  private providerService = inject(ProviderService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private stack = inject(ModalStackService);
  readonly branchContext = inject(BranchContextService);

  providerModel = signal<{ id: GUID | null; name: string }>({ id: null, name: '' });
  providerForm = form(this.providerModel, (s) => {
    required(s.id, { message: 'Seleccioná un proveedor' });
  });

  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  /** Nivel 1 por signals (sin URL): catalogue, edit, crear-producto, confirm. */
  showConfirm = signal(false);
  showAddCatalogueModal = signal(false);
  showEditModal = signal(false);
  showCreateProductModal = signal(false);
  private catalogueModal = useStackedModal(this.stack, this.showAddCatalogueModal);
  private editModal = useStackedModal(this.stack, this.showEditModal);
  private productModal = useStackedModal(this.stack, this.showCreateProductModal);
  private confirmModal = useStackedModal(this.stack, this.showConfirm, () => !this.isSubmitting());
  editingItem = signal<{ index: number; item: ItemForm } | null>(null);
  pendingProduct = signal<ProductSearchResult | null>(null);
  pendingName = signal('');
  creatingFromEdit = signal(false);
  pendingCreated = signal<ProductSearchResult | null>(null);

  reception = signal<Reception>({ notes: '', items: [] });

  existingProductIds = computed(() =>
    this.reception()
      .items.map((i) => i.product.id)
      .filter((id): id is GUID => id !== null),
  );

  totalCost = computed(() =>
    this.reception()
      .items.flatMap((g: ItemForm) => g.variants)
      .reduce(
        (sum: number, v: VariantForm) => sum + (v.quantityReceived ?? 0) * (v.unitCost ?? 0),
        0,
      ),
  );

  totalUnits = computed(() =>
    this.reception()
      .items.flatMap((g: ItemForm) => g.variants)
      .reduce((sum: number, v: VariantForm) => sum + (v.quantityReceived ?? 0), 0),
  );

  // ── Nivel 1: abrir/cerrar + registro en la pila (el atrás cierra el tope) ──
  private openCatalogue(): void {
    this.catalogueModal.open();
  }

  closeCatalogue(): void {
    this.catalogueModal.close();
  }

  private openEdit(): void {
    this.editModal.open();
  }

  closeEdit(): void {
    this.editModal.close();
  }

  private openProduct(): void {
    this.productModal.open();
  }

  closeProduct(): void {
    this.productModal.close();
  }

  private openConfirm(): void {
    this.confirmModal.open();
  }

  /** Cierra el confirm (bloqueado durante el POST; el atrás reintenta). */
  closeConfirm(): void {
    this.confirmModal.close();
  }

  updateNotes(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.reception.update((r) => ({ ...r, notes: target.value }));
  }

  addGroup(group: { index: number | null; item: ItemForm }): void {
    const alreadyExists = this.reception().items.some(
      (i) => i.product.id === group.item.product.id,
    );
    if (alreadyExists) {
      this.submitError.set('Este producto ya fue agregado a la recepción.');
      return;
    }
    this.reception.update((r) => ({ ...r, items: [...r.items, group.item] }));
    this.pendingProduct.set(null);
    this.closeCatalogue();
  }

  updateItem(itemToUpdate: { index: number | null; item: ItemForm }): void {
    this.reception.update((r) => {
      const items = [...r.items];
      items[itemToUpdate.index!] = itemToUpdate.item;
      return { ...r, items };
    });
    this.pendingCreated.set(null);
    this.closeEdit();
  }

  removeGroup(index: number): void {
    this.reception.update((r) => ({
      ...r,
      items: r.items.filter((_, i) => i !== index),
    }));
  }

  onSubmit(): void {
    if (!this.reception().items.length || this.isSubmitting()) return;

    this.providerForm().markAsTouched();
    if (this.providerForm().invalid()) {
      this.submitError.set('Seleccioná un proveedor antes de guardar.');
      return;
    }

    this.submitError.set(null);
    this.openConfirm();
  }

  executeCreate(): void {
    if (this.isSubmitting()) return;

    const payload: CreateReceptionDto = {
      notes: this.reception().notes,
      providerId: this.providerModel().id!,
      items: this.reception().items.flatMap((g) =>
        g.variants.map((v) => ({
          productVariantId: v.id!,
          quantityReceived: v.quantityReceived!,
          unitCost: v.unitCost!,
        })),
      ),
    };

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.receptionService.create(payload).subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        // El confirm nunca tocó el historial: un replace basta (atrás → lista).
        this.closeConfirm();
        this.router.navigate(['inventory', 'receptions', result.id], { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        // El modal queda abierto para reintentar; el error se muestra arriba.
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        const msg = e?.error?.detail || e?.error?.title || e?.message || 'Error al guardar la recepción. Intentá de nuevo.';
        this.submitError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  onCancel(): void {
    this.router.navigate(['inventory', 'receptions']);
  }

  editGroup(index: number) {
    this.pendingCreated.set(null);
    const item = this.reception().items[index] ?? null;
    this.editingItem.set(item ? { index, item } : null);
    if (item) this.openEdit();
  }

  onNotFound(query: string): void {
    this.creatingFromEdit.set(this.showEditModal());
    this.pendingName.set(query);
    if (this.showEditModal()) this.closeEdit();
    if (this.showAddCatalogueModal()) this.closeCatalogue();
    this.openProduct();
  }

  onProductCreated(product: ProductSearchResult): void {
    this.pendingProduct.set(product);
    this.closeProduct();
    if (this.creatingFromEdit()) {
      this.creatingFromEdit.set(false);
      this.pendingCreated.set(product);
      this.openEdit();
    } else {
      this.openCatalogue();
    }
  }

  onCreateProductCancelled(): void {
    this.closeProduct();
    if (this.creatingFromEdit()) {
      this.creatingFromEdit.set(false);
      this.openEdit();
    } else {
      this.openCatalogue();
    }
  }

  openAddCatalogueModal(): void {
    this.pendingProduct.set(null);
    this.openCatalogue();
  }
}
