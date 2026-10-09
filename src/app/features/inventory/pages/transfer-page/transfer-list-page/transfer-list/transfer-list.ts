import { Component, input, output, signal } from '@angular/core';
import { StockTransferListDto } from '../../../../dtos/transfers/stock-transfer-list-dto';
import { TransferListItem, TRANSFER_LIST_GRID } from './transfer-list-item/transfer-list-item';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';

@Component({
  selector: 'app-transfer-list',
  imports: [SkeletonList, TransferListItem],
  template: `
    @if (loading()) {
      <app-skeleton-list [rows]="4" [columns]="3" />
    } @else if (transfers().length === 0) {
      <div
        class="bg-bg-surface rounded-xl border border-border shadow-sm p-12
               flex flex-col items-center gap-3"
      >
        <span class="text-3xl opacity-30">⇅</span>
        <p class="text-sm text-text-soft">No hay transferencias registradas.</p>
      </div>
    } @else {
      <div
        class="flex flex-col gap-2.5
              lg:gap-0 lg:border lg:border-border lg:rounded-xl lg:overflow-hidden lg:shadow-sm lg:bg-bg-surface"
      >
        <!-- Header — solo desktop -->
        <div
          class="hidden lg:grid px-4 py-2 border-b border-border bg-bg-muted
             text-[11px] font-semibold text-text-soft uppercase tracking-wide"
          [style.grid-template-columns]="gridCols"
        >
          <span class="pr-4">Nº</span>
          <span class="pr-4">Creado</span>
          <span>Dirección</span>
          <span>Estado</span>
          <span>Sucursal</span>
          <span>Solicitante</span>
          <span class="text-right pr-4">Uds</span>
          <span class="text-right pr-4">Resuelto</span>
          <span></span>
        </div>

        <!-- Items -->
        <ul class="flex flex-col gap-2.5 lg:gap-0 lg:divide-y lg:divide-border">
          @for (t of transfers(); track t.id; let i = $index) {
            <app-transfer-list-item
              [transfer]="t"
              [index]="t.id"
              (viewDetail)="viewDetail.emit($event)"
            />
          }
        </ul>
      </div>
    }
  `,
  styles: `
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

    @keyframes confirm-in {
      from {
        opacity: 0;
        transform: scaleY(0.9);
      }
      to {
        opacity: 1;
        transform: scaleY(1);
      }
    }
    .confirm-enter {
      animation: confirm-in 160ms ease both;
      transform-origin: top;
    }
  `,
})
export class TransferList {
  transfers = input.required<StockTransferListDto[]>();
  /** El template no puede llamar imports: se expone la constante tal cual. */
  readonly gridCols = TRANSFER_LIST_GRID;
  loading = input<boolean>(false);

  viewDetail = output<GUID>();
}
