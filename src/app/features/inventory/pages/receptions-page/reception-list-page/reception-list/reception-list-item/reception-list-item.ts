import { Component, inject, input, output} from '@angular/core';
import {ReceptionStatus, StockReceptionListDto} from '../../../../../dtos/receptions/stock-reception-list-dto';
import {DecimalPipe} from '@angular/common';
import {Router} from '@angular/router';
import ReceptionDetails from '../../../reception-details/reception-details';
import {SmartDatePipe} from '@shared/pipes/smart-date.pipe';

/** Columnas del grid desktop: header y filas comparten esta única fuente. */
export const RECEPTION_LIST_GRID =
  '5rem 7rem 9rem 1fr 6rem 5rem 7rem 5.5rem 3.5rem';

@Component({
  selector: 'app-reception-list-item',
  imports: [
    DecimalPipe,
    SmartDatePipe
  ],
  templateUrl: './reception-list-item.html',
  styles: ``,
})
export class ReceptionListItem {
  reception = input.required<StockReceptionListDto>();
  /** El template no puede llamar imports: se expone la constante tal cual. */
  readonly gridCols = RECEPTION_LIST_GRID;
  index     = input<number>(0);
  viewDetails = output<GUID>();
  readonly Status = ReceptionStatus;
  readonly router = inject(Router);


  statusClasses(s: ReceptionStatus): string {
    const map: Record<ReceptionStatus, string> = {
      [ReceptionStatus.Borrador]:   'bg-feedback-warning text-feedback-warning-text',
      [ReceptionStatus.Confirmado]: 'bg-feedback-success text-feedback-success-text',
      [ReceptionStatus.Rechazado]:  'bg-feedback-error text-feedback-error-text',
      [ReceptionStatus.Revertida]:  'bg-feedback-error text-feedback-error-text',
    };
    return map[s];
  }
}
