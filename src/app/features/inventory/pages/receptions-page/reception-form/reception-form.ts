import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { closeModal, getModalId, openModal, swapModal } from '@shared/utils/modal-query';
import { ToastService } from '@core/services/toast-service';
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
export default class ReceptionForm implements OnInit {
  ngOnInit(): void {
    this.categoryService.load();
    this.colorService.load();
    this.brandService.load();
    this.providerService.load();
  }

  private receptionService = inject(ReceptionService);
  private categoryService = inject(CategoryService);
  private colorService = inject(ColorService);
  private brandService = inject(BrandService);
  private providerService = inject(ProviderService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private router = inject(Router);
  readonly branchContext = inject(BranchContextService);

  providerModel = signal<{ id: GUID | null; name: string }>({ id: null, name: '' });
  providerForm = form(this.providerModel, (s) => {
    required(s.id, { message: 'Seleccioná un proveedor' });
  });

  isSubmitting = signal(false);
  submitError = signal<string | null>(null);
  showConfirm = signal(false);
  /** Entradas de historial con ?modal= pusheadas y pendientes de consumir. */
  private modalEntries = signal(0);
  showAddCatalogueModal = signal(false);
  showEditModal = signal(false);
  editingItem = signal<{ index: number; item: ItemForm } | null>(null);
  showCreateProductModal = signal(false);
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

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const modal = params.get('modal');
      // Sin ?modal= no hay entradas nuestras por consumir (atrás manual o recarga)
      if (!modal) this.modalEntries.set(0);
      this.showAddCatalogueModal.set(modal === 'catalogue');
      this.showCreateProductModal.set(modal === 'product');
      // El confirm solo vive si hay ítems (ej. recarga con ?modal=confirm no abre vacío)
      this.showConfirm.set(modal === 'confirm' && this.reception().items.length > 0);

      const editId = getModalId(modal, 'edit');
      if (editId) {
        const idx = parseInt(editId, 10);
        const item = this.reception().items[idx] ?? null;
        this.editingItem.set(item ? { index: idx, item } : null);
        this.showEditModal.set(!!item);
      } else {
        this.editingItem.set(null);
        this.showEditModal.set(false);
      }
    });
  }

  /**
   * Página → modal: push + contador (el atrás cierra sin salir).
   */
  private pushModal(modal: string): void {
    this.modalEntries.update((n) => n + 1);
    openModal(this.router, this.route, modal);
  }

  /**
   * Modal → modal: reutiliza la entrada (el atrás no reabre intermedios).
   */
  private swapModal(modal: string): void {
    swapModal(this.router, this.route, modal);
  }

  /**
   * Cierra el modal abierto dejando el historial intacto: consume con
   * back() la entrada pusheada. Fallback al helper solo si no hay entrada
   * que consumir (ej. recarga con ?modal= en URL).
   */
  closeModal(): void {
    if (this.modalEntries() > 0) {
      this.modalEntries.update((n) => n - 1);
      history.back();
    } else {
      closeModal(this.router, this.route);
    }
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
    this.closeModal();
  }

  updateItem(itemToUpdate: { index: number | null; item: ItemForm }): void {
    this.reception.update((r) => {
      const items = [...r.items];
      items[itemToUpdate.index!] = itemToUpdate.item;
      return { ...r, items };
    });
    this.pendingCreated.set(null);
    this.closeModal();
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
    this.pushModal('confirm');
  }

  closeConfirm(): void {
    if (this.isSubmitting()) return;
    this.closeModal();
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
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['inventory', 'receptions']);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.closeModal();
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
    this.pushModal(`edit:${index}`);
  }

  onNotFound(query: string): void {
    this.creatingFromEdit.set(this.showEditModal());
    this.pendingName.set(query);
    this.swapModal('product');
  }

  onProductCreated(product: ProductSearchResult): void {
    this.pendingProduct.set(product);
    if (this.creatingFromEdit()) {
      this.creatingFromEdit.set(false);
      this.pendingCreated.set(product);
      this.swapModal('edit:' + this.editingItem()!.index);
    } else {
      this.swapModal('catalogue');
    }
  }

  onCreateProductCancelled(): void {
    if (this.creatingFromEdit()) {
      this.creatingFromEdit.set(false);
      this.swapModal('edit:' + this.editingItem()!.index);
    } else {
      this.swapModal('catalogue');
    }
  }

  openAddCatalogueModal(): void {
    this.pendingProduct.set(null);
    this.pushModal('catalogue');
  }
}
