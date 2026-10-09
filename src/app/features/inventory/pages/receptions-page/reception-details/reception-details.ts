import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Observable, map, throwError } from 'rxjs';
import {
  CheckActionResult,
  VerifyActionModal,
} from '@shared/components/verify-action-modal/verify-action-modal';

import { ReceptionService } from '../../../services/reception-service';
import { LabelData } from '../../../interfaces/reception-labels';
import { LabelPrintService, SheetFormat } from '../../../services/print-label-service';
import { ReceptionLabelsDto } from '../../../dtos/receptions/reception-labels-dto';
import { ReceptionStatus } from '../../../dtos/receptions/stock-reception-list-dto';
import {
  StockReceptionDetailDto,
} from '../../../dtos/receptions/stock-reception-details-dto';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';

@Component({
  selector: 'app-reception-details',
  imports: [DatePipe, CurrencyPipe, DecimalPipe, SkeletonList, VerifyActionModal],
  templateUrl: './reception-details.html',
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
export default class ReceptionDetails implements OnInit {
  private receptionService = inject(ReceptionService);
  private route = inject(ActivatedRoute);
  readonly router = inject(Router);

  readonly Status = ReceptionStatus;

  reception = signal<StockReceptionDetailDto | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  rollbackModalOpen = signal(false);
  private printService = inject(LabelPrintService);

  sheetFormat = signal<SheetFormat>('a4');
  readonly sheetOptions: { value: SheetFormat; label: string }[] = [
    { value: 'a4', label: 'A4 · 56' },
    { value: 'a5', label: 'A5 · 24' },
    { value: 'a6', label: 'A6 · 12' },
  ];

  onSheetFormatChange(value: string): void {
    this.sheetFormat.set(value as SheetFormat);
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['inventory', 'receptions']);
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadDetail(id);
  }

  private loadDetail(id: GUID): void {
    this.loading.set(true);
    this.error.set(null);
    this.receptionService.getReceptionDetail(id).subscribe({
      next: (data) => {
        this.reception.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la recepción.');
        this.loading.set(false);
      },
    });
  }

  // ── Modal: Rollback ───────────────────────────────────────────────────────
  openRollbackModal(): void {
    this.rollbackModalOpen.set(true);
  }
  closeRollbackModal(): void {
    this.rollbackModalOpen.set(false);
  }

  onRollbackSuccess(): void {
    this.closeRollbackModal();
    this.router.navigate(['inventory', 'receptions']);
  }

  readonly rollbackReasonMessages: Record<string, string> = {
    ALREADY_REVERTED: 'Esta recepción ya fue revertida anteriormente.',
    OUTDATED: 'No se puede revertir: la recepción supera las 24 horas.',
    NOT_ENOUGH_STOCK: 'No se puede revertir: stock insuficiente en la sucursal.',
  };

  readonly checkRollback = (): Observable<CheckActionResult> => {
    const id = this.reception()?.id;
    if (!id) return throwError(() => new Error('Sin recepción'));
    return this.receptionService
      .checkCanRevert(id)
      .pipe(map((r) => ({ canProceed: r.canRevert, reason: r.reason || undefined })));
  };

  readonly executeRollback = (): Observable<void> => {
    const id = this.reception()?.id;
    if (!id) return throwError(() => new Error('Sin recepción'));
    return this.receptionService.rollbackReception(id).pipe(map(() => void 0));
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  statusClasses(s: ReceptionStatus): string {
    const map: Record<ReceptionStatus, string> = {
      [ReceptionStatus.Borrador]: 'badge-warning',
      [ReceptionStatus.Confirmado]: 'badge-success',
      [ReceptionStatus.Rechazado]: 'badge-error',
      [ReceptionStatus.Revertida]: 'badge-error',
    };
    return map[s];
  }

  /** Items agrupados producto → color (solo vista): preserva el orden del backend. */
  groupedItems = computed(() => {
    const items = this.reception()?.items ?? [];
    interface SizeRow {
      size: string;
      qty: number;
      unitCost: number;
      subtotal: number;
      sku: string;
    }
    interface ColorGroup {
      color: string;
      units: number;
      subtotal: number;
      unitCost: number | null;
      summary: string;
      skus: string;
      sizes: SizeRow[];
    }
    interface ProductGroup {
      productName: string;
      units: number;
      subtotal: number;
      colors: ColorGroup[];
    }
    const products = new Map<string, ProductGroup>();
    for (const item of items) {
      let p = products.get(item.productName);
      if (!p) {
        p = { productName: item.productName, units: 0, subtotal: 0, colors: [] };
        products.set(item.productName, p);
      }
      let c = p.colors.find((g) => g.color === item.color);
      if (!c) {
        c = { color: item.color, units: 0, subtotal: 0, unitCost: item.unitCost, summary: '', skus: '', sizes: [] };
        p.colors.push(c);
      }
      if (c.unitCost !== item.unitCost) c.unitCost = null;
      c.sizes.push({ size: item.size, qty: item.quantityReceived, unitCost: item.unitCost, subtotal: item.subtotal, sku: item.sku });
      c.units += item.quantityReceived;
      c.subtotal += item.subtotal;
      p.units += item.quantityReceived;
      p.subtotal += item.subtotal;
    }
    for (const p of products.values()) {
      for (const c of p.colors) {
        c.summary = c.sizes.map((s) => `${s.size} ×${s.qty}`).join(' · ');
        c.skus = [...new Set(c.sizes.map((s) => s.sku))].join(' · ');
      }
    }
    return [...products.values()];
  });

  get totalQuantity(): number {
    return this.reception()?.items.reduce((sum, i) => sum + i.quantityReceived, 0) ?? 0;
  }

  async generarEtiquetas(): Promise<void> {
    const id = this.reception()?.id;
    if (!id) return;

    this.loading.set(true);

    this.receptionService.getReceptionLabels(id).subscribe({
      next: async (data: ReceptionLabelsDto) => {
        try {
          const labels: LabelData[] = data.items.flatMap((item) =>
            Array.from({ length: item.quantity }, (): LabelData => ({
              variantId: item.variantId,
              sku: item.sku,
              productName: item.productName,
              brandName: item.brandName,
              size: item.size,
              color: item.color,
              gender: item.gender,
              price: item.price,
              receptionId: data.receptionId,
            })),
          );
          const doc = await this.printService.generatePdfCompact(labels, this.sheetFormat());
          doc.save(`etiquetas-recepcion-${data.number ?? data.receptionId}-${this.sheetFormat()}.pdf`);
        } catch (e) {
          console.error('Error generando PDF de etiquetas', e);
        } finally {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        console.error('No se pudieron obtener las etiquetas.');
      },
    });
  }

  protected readonly print = print;
}
