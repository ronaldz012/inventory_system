import {Component, inject, input, OnInit, output, signal} from '@angular/core';
import {CurrencyPipe, DatePipe, KeyValuePipe} from '@angular/common';
import {StockReceptionListDto} from '../../../../dtos/receptions/stock-reception-list-dto';
import {ReceptionListItem, RECEPTION_LIST_GRID} from './reception-list-item/reception-list-item';
import {ReceptionService} from '../../../../services/reception-service';
import {Router} from '@angular/router';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';

@Component({
  selector: 'app-reception-list',
  imports: [ReceptionListItem,SkeletonList],
  template: `
    @if (loading()) {
      <app-skeleton-list [rows]="4" [columns]="3" />
    } @else if (receptions().length === 0) {
      <!-- Empty state -->
      <div class="flex flex-col items-center gap-3 p-12 rounded border border-border bg-bg-surface shadow-sm">
        <span class="text-3xl opacity-60">📦</span>
        <p class="font-inter text-sm font-medium text-text-muted">No hay recepciones registradas.</p>
      </div>
    } @else {
      <!-- Wrapper tabla -->
      <div class="flex flex-col overflow-hidden rounded border border-border bg-bg-surface shadow-sm">

        <!-- Header columnas — solo desktop -->
        <div
          class="hidden px-4 py-3 border-b border-border bg-bg-muted lg:grid
                 font-inter text-xs font-semibold uppercase tracking-wider text-text-soft"
          [style.grid-template-columns]="gridCols"
        >
          <span>Nº</span>
          <span>Fecha</span>
          <span>Proveedor</span>
          <span>Marcas</span>
          <span class="pr-4 text-right">Talla/Color</span>
          <span class="pr-4 text-right">Uds</span>
          <span class="pr-4 text-right">Costo total (Bs)</span>
          <span>Estado</span>
          <span></span>
        </div>

        <!-- Items -->
        <ul class="flex flex-col divide-y divide-border font-inter text-sm text-text-main">
          @for (r of receptions(); track r.id; let i = $index) {
            <app-reception-list-item
              [reception]="r"
              [index]="i"
              (viewDetails)="goToDetails.emit($event)"
            />
          }
        </ul>
      </div>
    }
  `,
  styles: `
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .row-enter { animation: slide-up 220ms ease both; }
  `,
})
export default class ReceptionList {
  router = inject(Router);
  /** El template no puede llamar imports: se expone la constante tal cual. */
  readonly gridCols = RECEPTION_LIST_GRID;
  receptions = input.required<StockReceptionListDto[]>();
  loading    = input<boolean>(false);
  goToDetails = output<GUID>();
  rollback = output<GUID>;
}
