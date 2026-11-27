import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { form, required } from '@angular/forms/signals';
import { ReceptionItem } from './reception-item/reception-item';
import { ReceptionConfirmModal } from './reception-confirm-modal';
import CatalogueItemModal from '../catalogue-item-modal/catalogue-item-modal';
import CreateProductModal from '../../products-page/create-product-modal/create-product-modal';
import CreateReceptionDto from '@features/inventory/dtos/receptions/create-reception-dto';
import UpdateDraftDto from '@features/inventory/dtos/receptions/update-draft-dto';
import {
  StockReceptionDetailDto,
  StockReceptionItemDetailDto,
  MIN_UNIT_COST,
} from '@features/inventory/dtos/receptions/stock-reception-details-dto';
import { ReceptionStatus } from '@features/inventory/dtos/receptions/stock-reception-list-dto';
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

/**
 * Arma el modelo del form desde el detail del borrador: agrupa por producto,
 * igual que lo hace el flujo de crear (una `ItemForm` por producto).
 */
function groupDraftItems(items: StockReceptionItemDetailDto[]): ItemForm[] {
  const groups: ItemForm[] = [];
  const byProduct = new Map<GUID, ItemForm>();
  for (const it of items) {
    let group = byProduct.get(it.productId);
    if (!group) {
      group = {
        product: {
          id: it.productId,
          productName: it.productName,
          internalCode: '',
          categoryName: '',
          brandName: it.brandName,
          genderName: '',
          description: '',
        },
        variants: [],
      };
      byProduct.set(it.productId, group);
      groups.push(group);
    }
    group.variants.push({
      mode: 'ex',
      id: it.productVariantId,
      sizeId: it.sizeId,
      sizeName: it.size,
      // El sort del editor de ítems replica el orden del backend; sin el
      // sizeOrder real, re-agregar una talla revolvería las precargadas.
      sizeOrder: it.sizeOrder ?? 0,
      colorId: it.colorId,
      colorCode: '',
      colorName: it.color,
      // Alimenta el resumen Ventas/Ganancia esperada del editor.
      price: it.price ?? null,
      quantityReceived: it.quantityReceived,
      unitCost: it.unitCost,
      sku: it.sku,
      selected: true,
    });
  }
  return groups;
}

@Component({
  selector: 'app-reception-form',
  imports: [
    ReceptionItem,
    MoneyPipe,
    CatalogueItemModal,
    CreateProductModal,
    ProviderSelectCtrl,
    ReceptionConfirmModal,
  ],
  templateUrl: './reception-form.html',
})
export default class ReceptionForm implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.categoryService.load();
    this.colorService.load();
    this.brandService.load();
    this.providerService.load();

    // Modo edición: /receptions/:id/edit — misma vista, sobre un borrador.
    const editId = this.route.snapshot.paramMap.get('id');
    if (editId) {
      this.editId.set(editId);
      this.loadDraft(editId);
    }
  }

  ngOnDestroy(): void {
    this.catalogueModal.destroy();
    this.editModal.destroy();
    this.productModal.destroy();
    this.confirmModal.destroy();
  }

  /** Id del borrador en edición; null = modo creación. */
  editId = signal<GUID | null>(null);
  editing = computed(() => this.editId() !== null);
  draftNumber = signal<number | null>(null);

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
  creatingFromEdit = signal(false);
  pendingCreated = signal<ProductSearchResult | null>(null);

  reception = signal<Reception>({ notes: '', items: [] });

  /**
   * Variantes sin costo de compra: el borrador las permite, el confirm no
   * (mín. Bs 0.50 — espejo del backend). Guía al usuario antes del POST.
   */
  uncostedCount = computed(
    () =>
      this.reception()
        .items.flatMap((g) => g.variants)
        .filter((v) => (v.unitCost ?? 0) < MIN_UNIT_COST).length,
  );

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

  private loadDraft(id: GUID): void {
    this.receptionService.getReceptionDetail(id).subscribe({
      next: (d: StockReceptionDetailDto) => {
        if (d.status !== ReceptionStatus.Borrador) {
          this.toast.error('Solo las recepciones en borrador se pueden editar.');
          this.router.navigate(['inventory', 'receptions', id]);
          return;
        }
        this.draftNumber.set(d.number);
        this.providerModel.set({ id: d.providerId, name: d.providerName });
        this.reception.set({ notes: d.notes ?? '', items: groupDraftItems(d.items) });
      },
      error: () => {
        this.toast.error('No se pudo cargar el borrador.');
        this.router.navigate(['inventory', 'receptions']);
      },
    });
  }

  onSubmit(): void {
    if (!this.validateForSave()) return;

    // Confirmar exige costo en todas las líneas; guardar borrador no.
    if (this.uncostedCount() > 0) {
      const n = this.uncostedCount();
      this.submitError.set(
        `${n} ${n === 1 ? 'talla/color sin' : 'tallas/colores sin'} costo. ` +
          `Completá el costo (mín. Bs 0.50) para confirmar, o guardá como borrador.`,
      );
      return;
    }

    this.submitError.set(null);
    this.openConfirm();
  }

  /** Guarda directo como borrador: no mueve stock, por eso no pasa por el confirm. */
  saveDraft(): void {
    // El borrador es un contenedor: puede guardarse sin ítems (se completan
    // después desde el catálogo o reponiendo desde un producto).
    if (!this.validateForSave(false)) return;

    this.submitError.set(null);
    this.executeCreate(true);
  }

  private validateForSave(requireItems = true): boolean {
    if (this.isSubmitting()) return false;
    if (requireItems && !this.reception().items.length) return false;

    this.providerForm().markAsTouched();
    if (this.providerForm().invalid()) {
      this.submitError.set('Seleccioná un proveedor antes de guardar.');
      return false;
    }
    return true;
  }

  /** Lista final de ítems — la misma forma para crear y para editar. */
  private buildItemsPayload() {
    return this.reception().items.flatMap((g) =>
      g.variants.map((v) => ({
        productVariantId: v.id!,
        quantityReceived: v.quantityReceived!,
        // Costo vacío = desconocido: el backend (decimal) recibe 0.
        unitCost: v.unitCost ?? 0,
      })),
    );
  }

  executeCreate(saveAsDraft = false): void {
    if (this.isSubmitting()) return;

    const payload: CreateReceptionDto = {
      notes: this.reception().notes,
      providerId: this.providerModel().id!,
      saveAsDraft,
      items: this.buildItemsPayload(),
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
        const msg =
          e?.error?.detail ||
          e?.error?.title ||
          e?.message ||
          'Error al guardar la recepción. Intentá de nuevo.';
        this.submitError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  /**
   * Modo edición: PUT full-replace con la lista final completa. El confirmar
   * queda en el detalle — acá solo se guarda el borrador.
   */
  saveDraftEdit(): void {
    const id = this.editId();
    if (!id || !this.validateForSave() || this.isSubmitting()) return;

    this.submitError.set(null);
    const dto: UpdateDraftDto = {
      providerId: this.providerModel().id!,
      notes: this.reception().notes,
      items: this.buildItemsPayload(),
    };

    this.isSubmitting.set(true);
    this.receptionService.updateDraft(id, dto).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toast.success('Borrador actualizado');
        // replaceUrl: atrás desde el detalle no vuelve al edit ya consumido.
        this.router.navigate(['inventory', 'receptions', id], { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        const msg =
          e?.error?.detail ||
          e?.error?.title ||
          e?.message ||
          'Error al guardar el borrador. Intentá de nuevo.';
        this.submitError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  onCancel(): void {
    const id = this.editId();
    if (id) this.router.navigate(['inventory', 'receptions', id]);
    else this.router.navigate(['inventory', 'receptions']);
  }

  editGroup(index: number) {
    this.pendingCreated.set(null);
    const item = this.reception().items[index] ?? null;
    this.editingItem.set(item ? { index, item } : null);
    if (item) this.openEdit();
  }

  onNotFound(): void {
    this.creatingFromEdit.set(this.showEditModal());
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
