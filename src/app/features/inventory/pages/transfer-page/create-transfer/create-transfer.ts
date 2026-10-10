import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SkuInput } from '@shared/components/sku-input/sku-input';
import { QrScannerModal, isBarcodeApiAvailable } from '@features/sales/components/qr-scanner-modal/qr-scanner-modal';
import { CreateTransferItemList } from './create-transfer-item-list/create-transfer-item-list';
import { TransferConfirmModal } from './transfer-confirm-modal';
import { closeModal, openModal } from '@shared/utils/modal-query';
import { TransferService } from '../../../services/transfer-service';
import { ProductService } from '@features/inventory/services/product-service';

import { TransferItem } from '../../../interfaces/transfer-item';
import { TransferForm } from '../../../dtos/transfers/transfer-form';
import { ProductVariantBySkuDto } from '../../../dtos/products/product-variant-by-sku-dto';
import { BranchContextService } from '@core/services/branch-context-service';
import { BranchDto } from '@core/interfaces/branch.model';
import { BranchSelectorDestination } from '@shared/components/branch-selector-destination/branch-selector-destination';
import { ToastService } from '@core/services/toast-service';

@Component({
  selector: 'app-create-transfer',
  imports: [SkuInput, QrScannerModal, CreateTransferItemList, FormsModule, BranchSelectorDestination, TransferConfirmModal],
  templateUrl: './create-transfer.html',
})
export default class CreateTransfer implements OnInit {
  private transferService = inject(TransferService);
  private productService = inject(ProductService);
  private branchService = inject(BranchContextService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);

  searchingSku = signal(false);
  skuError = signal('');
  scannerAvailable = signal(false);

  branches = signal<BranchDto[]>([]);
  loadingBranches = signal(false);

  items = signal<TransferItem[]>([]);

  /** Notas colapsadas por defecto (ahorra ~120px en mobile). */
  notesOpen = signal(false);

  /** Fila resaltada tras agregar/sumar (se limpia sola, sin mover la vista). */
  lastAddedId = signal<GUID | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  form = signal<TransferForm>({
    toBranchId: null,
    notes: '',
    items: [],
  });

  canSubmit = computed(() => this.form().toBranchId !== null && this.items().length > 0);

  totalUnits = computed(() => this.items().reduce((sum, i) => sum + i.quantity, 0));

  originName = computed(() => this.branchService.active()?.branchName ?? '');

  destName = computed(
    () => this.branches().find((b) => b.id === this.form().toBranchId)?.name ?? '',
  );

  showConfirm = signal(false);
  isSubmitting = signal(false);
  /** Entrada de historial con ?modal=confirm por consumir. */
  private confirmEntryPushed = signal(false);

  async ngOnInit(): Promise<void> {
    this.route.queryParamMap.subscribe((params) => {
      const open = params.get('modal') === 'confirm';
      // Sin ítems o destino no hay nada que confirmar (ej. recarga con el param)
      this.showConfirm.set(open && this.items().length > 0 && this.form().toBranchId !== null);
      if (!open) this.confirmEntryPushed.set(false);
    });
    this.scannerAvailable.set(await isBarcodeApiAvailable());
    this.loadBranches();
  }

  openScanner(scanner: QrScannerModal): void {
    scanner.open();
  }

  private loadBranches(): void {
    this.loadingBranches.set(true);
    this.branchService.getBranches().subscribe({
      next: (branches) => {
        const currentId = this.branchService.active()?.branchId ?? 0;
        this.branches.set(branches.filter((b) => b.id !== currentId));
        this.loadingBranches.set(false);
      },
      error: () => this.loadingBranches.set(false),
    });
  }

  onBranchSelected(branch: BranchDto): void {
    this.form.update((f) => ({ ...f, toBranchId: branch.id }));
  }

  patchNotes(notes: string): void {
    this.form.update((f) => ({ ...f, notes }));
  }

  onSkuSubmit(sku: string): void {
    if (!sku || this.searchingSku()) return;
    this.searchingSku.set(true);
    this.skuError.set('');
    this.productService.getVariantBySku(sku).subscribe({
      next: (variant) => {
        this.searchingSku.set(false);
        this.addVariantToTransfer(variant);
      },
      error: (err) => {
        this.searchingSku.set(false);
        const msg = err.status === 404 ? `No se encontró "${sku}"` : err.status === 409 ? `El producto "${sku}" está inactivo` : 'Error al buscar el producto';
        this.skuError.set(msg);
      },
    });
  }

  private addVariantToTransfer(variant: ProductVariantBySkuDto): void {
    const existing = this.items().find((i) => i.variantId === variant.id);
    if (existing) {
      if (existing.quantity >= variant.availableStockInBranch) return;
      const qty = existing.quantity + 1;
      this.items.update((items) =>
        items.map((i) => (i.variantId === variant.id ? { ...i, quantity: qty } : i)),
      );
      const parts = [variant.brandName, variant.productName, variant.colorName, variant.size].filter(
        Boolean,
      );
      this.toastService.success(`${parts.join(' · ')} ×${qty}`);
      this.flashAdded(variant.id);
    } else {
      if (variant.availableStockInBranch <= 0) {
        this.toastService.warning(`${variant.displayName} no tiene stock en la sucursal de origen`);
        return;
      }
      // Prepend: lo nuevo queda pegado al scanner, siempre visible.
      this.items.update((items) => [
        {
          variantId: variant.id,
          productId: variant.productId,
          sku: variant.sku,
          productName: variant.productName,
          brandName: variant.brandName ?? '',
          variantLabel: variant.displayName,
          size: variant.size,
          colorName: variant.colorName,
          quantity: 1,
          maxQuantity: variant.availableStockInBranch,
        },
        ...items,
      ]);
      const parts = [variant.brandName, variant.productName, variant.colorName, variant.size].filter(
        Boolean,
      );
      this.toastService.success(`${parts.join(' · ')} agregada`);
      this.flashAdded(variant.id);
    }
  }

  private flashAdded(variantId: GUID): void {
    this.lastAddedId.set(variantId);
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      if (this.lastAddedId() === variantId) this.lastAddedId.set(null);
    }, 1500);
  }

  // @deprecated - mantener compatibilidad hasta eliminar ProductVariantSearch
  onProductFound(variant: ProductVariantBySkuDto): void {
    this.addVariantToTransfer(variant);
  }

  submit(): void {
    if (!this.canSubmit() || this.isSubmitting()) return;
    this.confirmEntryPushed.set(true);
    openModal(this.router, this.route, 'confirm');
  }

  closeConfirm(): void {
    if (this.isSubmitting()) return;
    this.dismissConfirm();
  }

  /**
   * Cierra el confirm dejando el historial intacto: consume con back() la
   * entrada que abrió el modal. Si ya no está abierto, no toca el historial.
   */
  private dismissConfirm(): void {
    if (this.showConfirm() && this.confirmEntryPushed()) {
      this.confirmEntryPushed.set(false);
      history.back();
    } else {
      closeModal(this.router, this.route);
    }
  }

  executeCreate(): void {
    if (!this.canSubmit() || this.isSubmitting()) return;

    const payload: TransferForm = {
      ...this.form(),
      items: this.items().map((i) => ({
        productVariantId: i.variantId,
        quantityRequested: i.quantity,
      })),
    };

    this.isSubmitting.set(true);
    this.transferService.createTransfer(payload).subscribe({
      next: (id) => {
        this.isSubmitting.set(false);
        this.toastService.success('Transferencia creada');
        this.router.navigate(['inventory', 'transfers', id]);
      },
      error: (err: unknown) => {
        this.isSubmitting.set(false);
        this.dismissConfirm();
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.toastService.error(e?.error?.detail || e?.error?.title || e?.message || 'Error al crear la transferencia.');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['inventory', 'transfers']);
  }
}
