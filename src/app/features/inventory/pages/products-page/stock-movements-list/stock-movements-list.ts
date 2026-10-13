import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ListStockMovementDto,
  StockMovementParams,
} from '@features/inventory/dtos/products/list-stock-movements-dto';
import { MovementType, movementTypeToSpanish } from '@features/inventory/interfaces/movement-type';
import { ProductVariantDetailsDto } from '@features/inventory/dtos/products/product-variant-details';
import { ProductService } from '@features/inventory/services/product-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import SkeletonList from '../../../../../shared/ui/skeleton-list/skeleton-list';
import { Paginator } from '@shared/components/app-paginator/app-paginator';
import { NgClass } from '@angular/common';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';

@Component({
  selector: 'app-stock-movements-list',
  imports: [SkeletonList, Paginator, NgClass, SmartDatePipe, MoneyPipe],
  templateUrl: './stock-movements-list.html',
  styles: [
    `
      @keyframes slide-up {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .row-enter {
        animation: slide-up 220ms ease both;
      }
    `,
  ],
})
export default class StockMovementsList {
  private router = inject(Router);
  private service = inject(ProductService);
  private route = inject(ActivatedRoute);
  readonly perm = inject(PermissionService);

  protected readonly movementTypeToSpanish = movementTypeToSpanish;

  movements = signal<ListStockMovementDto[]>([]);
  totalItems = signal(0);
  loading = signal(false);
  variantId = signal<string>('');
  variant = signal<ProductVariantDetailsDto | null>(null);
  query = signal<StockMovementParams>({
    page: 1,
    pageSize: 10,
  });

  ngOnInit() {
    const idFromRoute = this.route.snapshot.paramMap.get('id');
    if (idFromRoute) {
      this.variantId.set(idFromRoute);
      this.loadVariant();
      this.load();
    } else {
      this.router.navigate(['inventory', 'products']);
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['inventory', 'products']);
    }
  }

  private loadVariant() {
    this.service.getVariantDetails(this.variantId()).subscribe({
      next: (data) => this.variant.set(data),
      error: () => this.variant.set(null),
    });
  }

  patchQuery(patch: Partial<{ page: number; pageSize: number }>) {
    this.query.update((q) => ({ ...q, ...patch }));
    this.load();
  }
  load() {
    this.loading.set(true);

    this.service.getVariantMovementsById(this.variantId(), this.query()).subscribe({
      next: (data) => {
        this.movements.set(data.items);
        this.totalItems.set(data.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
  goToReference(type: MovementType, referenceId: GUID) {
    if (!referenceId) return;

    switch (type) {
      case MovementType.Reception:
      case MovementType.ReceptionRevert:
        this.router.navigate(['inventory', 'receptions', referenceId]);
        break;
      case MovementType.Sale:
      case MovementType.Return:
        this.router.navigate(['sales', 'sale', referenceId]);
        break;
      case MovementType.Adjustment:
        // Ruta de ajustes aún no existe
        break;
      case MovementType.TransferIn:
      case MovementType.TransferOut:
        this.router.navigate(['inventory', 'transfers', referenceId]);
        break;
    }
  }

  canGoToReference(type: MovementType): boolean {
    if (
      type === MovementType.Reception ||
      type === MovementType.ReceptionRevert
    ) {
      return this.perm.can('inventory', 'receptions', 'read');
    }
    if (type === MovementType.Sale || type === MovementType.Return) {
      return this.perm.can('sales', 'sales', 'read');
    }
    if (type === MovementType.TransferIn || type === MovementType.TransferOut) {
      return this.perm.can('inventory', 'transfers', 'read');
    }
    return false;
  }

  referenceLabel(type: MovementType): string {
    switch (type) {
      case MovementType.Reception:
        return 'Ver recepción';
      case MovementType.ReceptionRevert:
        return 'Ver reversión';
      case MovementType.Sale:
        return 'Ver venta';
      case MovementType.Return:
        return 'Ver devolución';
      case MovementType.TransferIn:
      case MovementType.TransferOut:
        return 'Ver transferencia';
      default:
        return 'Ver detalle';
    }
  }
  getMovementColorClass(type: MovementType, element: 'badge' | 'text' | 'border'): string {
    const maps: Record<string, Record<MovementType, string>> = {
      badge: {
        [MovementType.Reception]:
          'bg-feedback-success/15 text-feedback-success-text border border-feedback-success/30',
        [MovementType.Sale]:
          'bg-feedback-info/15 text-feedback-info-text border border-feedback-info/30',
        [MovementType.Return]:
          'bg-feedback-success/15 text-feedback-success-text border border-feedback-success/30',
        [MovementType.Adjustment]:
          'bg-feedback-warning/15 text-feedback-warning-text border border-feedback-warning/30',
        [MovementType.TransferOut]: 'bg-bg-muted text-text-soft border border-border',
        [MovementType.TransferIn]: 'bg-accent-ui/10 text-accent-ui border border-accent-ui/20',
        [MovementType.ReceptionRevert]:
          'bg-feedback-error/10 text-feedback-error-text border border-feedback-error/30',
      },
      text: {
        [MovementType.Reception]: 'text-feedback-success-text',
        [MovementType.Sale]: 'text-feedback-error-text',
        [MovementType.Return]: 'text-feedback-success-text',
        [MovementType.Adjustment]: 'text-feedback-warning-text',
        [MovementType.TransferOut]: 'text-feedback-error-text',
        [MovementType.TransferIn]: 'text-feedback-success-text',
        [MovementType.ReceptionRevert]: 'text-feedback-error-text',
      },
      border: {
        [MovementType.Reception]: 'bg-feedback-success-text',
        [MovementType.Sale]: 'bg-feedback-info-text',
        [MovementType.Return]: 'bg-feedback-success-text',
        [MovementType.Adjustment]: 'bg-feedback-warning-text',
        [MovementType.TransferOut]: 'bg-text-soft',
        [MovementType.TransferIn]: 'bg-accent-ui',
        [MovementType.ReceptionRevert]: 'bg-feedback-error-text',
      },
    };
    return maps[element][type] || '';
  }
}
