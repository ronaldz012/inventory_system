import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ResolveTransferModal } from '../resolve-transfer-modal/resolve-transfer-modal';
import { ConfirmActionModal } from '../confirm-action-modal/confirm-action-modal';
import { TotalQtyPipe } from '../../../dtos/transfers/total-qty.pipe';
import { TransferService } from '../../../services/transfer-service';
import { TransferDirection, TransferStatus } from '../../../dtos/transfers/transfer-enums';
import { StockTransferDetailDto } from '../../../dtos/transfers/stock-transfer-detail-dto';
import { PermissionService } from '@features/auth/services/permmision-service';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { ToastService } from '@core/services/toast-service';
import { ModalStackService, useStackedModal } from '@core/modal-stack-service';

@Component({
  selector: 'app-transfer-details',
  imports: [DatePipe, TotalQtyPipe, SkeletonList, ResolveTransferModal, ConfirmActionModal],
  templateUrl: './transfer-details.html',
  styles: `
    @keyframes fade-up {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .fade-up {
      animation: fade-up 240ms ease both;
    }
  `,
})
export default class TransferDetails implements OnInit, OnDestroy {
  private transferService = inject(TransferService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private stack = inject(ModalStackService);
  readonly router = inject(Router);
  readonly perm = inject(PermissionService);

  readonly Status = TransferStatus;
  readonly Direction = TransferDirection;

  transfer = signal<StockTransferDetailDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  showResolveModal = signal(false);
  showCancelModal = signal(false);
  submitting = signal(false);
  private resolveModal = useStackedModal(this.stack, this.showResolveModal, () => !this.submitting());
  private cancelModal = useStackedModal(this.stack, this.showCancelModal, () => !this.submitting());

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['inventory', 'transfers']);
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadDetail(id);
  }

  ngOnDestroy(): void {
    this.resolveModal.destroy();
    this.cancelModal.destroy();
  }

  private loadDetail(id: GUID): void {
    this.loading.set(true);
    this.error.set(null);
    this.transferService.getTransferDetail(id).subscribe({
      next: (data) => {
        this.transfer.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la transferencia.');
        this.loading.set(false);
      },
    });
  }

  openResolveModal(): void {
    this.resolveModal.open();
  }
  closeResolveModal(): void {
    this.resolveModal.close();
  }

  onResolveConfirm(action: 'complete' | 'reject'): void {
    const id = this.transfer()?.id;
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    this.transferService.resolveTransfer(id, action).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(action === 'complete' ? 'Transferencia completada' : 'Transferencia rechazada');
        // Retorno al origen (colapsa el detalle): cerrar antes para que el guard deje pasar el pop.
        this.closeResolveModal();
        this.goBack();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.toast.error(e?.error?.detail || e?.error?.title || e?.message || 'Error al resolver la transferencia.');
      },
    });
  }

  // ── Modal: Cancel ─────────────────────────────────────────────────────────
  openCancelModal(): void {
    this.cancelModal.open();
  }
  closeCancelModal(): void {
    this.cancelModal.close();
  }

  onCancelConfirm(): void {
    const id = this.transfer()?.id;
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    this.transferService.cancelTransfer(id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Transferencia cancelada');
        this.closeCancelModal();
        this.goBack();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.toast.error(e?.error?.detail || e?.error?.title || e?.message || 'Error al cancelar la transferencia.');
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  statusLabel(s: TransferStatus): string {
    return ['Pendiente', 'En tránsito', 'Completada', 'Rechazada', 'Cancelada'][s];
  }

  statusClasses(s: TransferStatus): string {
    const map: Record<TransferStatus, string> = {
      [TransferStatus.Pendiente]: 'bg-feedback-warning text-feedback-warning-text',
      [TransferStatus.Transito]: 'bg-feedback-info text-feedback-info-text',
      [TransferStatus.Completada]: 'bg-feedback-success text-feedback-success-text',
      [TransferStatus.Rechazada]: 'bg-feedback-error text-feedback-error-text',
      [TransferStatus.Cancelada]: 'bg-bg-muted text-text-muted',
    };
    return map[s];
  }

  canResolve(t: StockTransferDetailDto): boolean {
    return (
      this.perm.can('inventory', 'transfers', 'update') &&
      t.direction === TransferDirection.Entrada &&
      t.status === TransferStatus.Pendiente
    );
  }

  canCancel(t: StockTransferDetailDto): boolean {
    return (
      this.perm.can('inventory', 'transfers', 'delete') &&
      t.direction === TransferDirection.Salida &&
      t.status === TransferStatus.Pendiente
    );
  }

  /** Items agrupados producto → color (solo vista): preserva el orden del backend. */
  groupedItems = computed(() => {
    const items = this.transfer()?.items ?? [];
    interface SizeRow {
      size: string;
      qty: number;
      sku: string;
    }
    interface ColorGroup {
      color: string;
      units: number;
      sizes: SizeRow[];
    }
    interface ProductGroup {
      productId: GUID;
      productName: string;
      brandName: string;
      units: number;
      colors: ColorGroup[];
    }
    const products = new Map<GUID, ProductGroup>();
    for (const item of items) {
      let p = products.get(item.productId);
      if (!p) {
        p = { productId: item.productId, productName: item.productName, brandName: item.brandName, units: 0, colors: [] };
        products.set(item.productId, p);
      }
      let c = p.colors.find((g) => g.color === item.color);
      if (!c) {
        c = { color: item.color, units: 0, sizes: [] };
        p.colors.push(c);
      }
      c.sizes.push({ size: item.size, qty: item.quantityRequested, sku: item.sku });
      c.units += item.quantityRequested;
      p.units += item.quantityRequested;
    }
    return [...products.values()];
  });
}
