import { Component, input, output } from '@angular/core';
import { StockTransferListDto } from '../../../../../dtos/transfers/stock-transfer-list-dto';
import { TransferDirection, TransferStatus } from '../../../../../dtos/transfers/transfer-enums';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';

/** Columnas del grid desktop: header y filas comparten esta única fuente. */
export const TRANSFER_LIST_GRID =
  '5rem 5.5rem 5rem 6rem 1fr 8rem 4.5rem 5.5rem 9rem';

@Component({
  selector: 'app-transfer-list-item',
  imports: [SmartDatePipe],
  templateUrl: './transfer-list-item.html',
  styles: ``,
})
export class TransferListItem {
  transfer = input.required<StockTransferListDto>();
  /** El template no puede llamar imports: se expone la constante tal cual. */
  readonly gridCols = TRANSFER_LIST_GRID;
  index = input<GUID>('');

  viewDetail = output<GUID>();

  readonly Status = TransferStatus;
  readonly Direction = TransferDirection;

  statusLabel(s: TransferStatus): string {
    return ['Pendiente', 'En tránsito', 'Completada', 'Rechazada', 'Cancelada'][s];
  }

  statusClasses(s: TransferStatus): string {
    const map: Record<TransferStatus, string> = {
      [TransferStatus.Pendiente]: 'badge-warning',
      [TransferStatus.Transito]: 'badge-info',
      [TransferStatus.Completada]: 'badge-success',
      [TransferStatus.Rechazada]: 'badge-error',
      [TransferStatus.Cancelada]: 'badge bg-bg-muted text-text-soft ring-border',
    };
    return map[s];
  }

  directionLabel(d: TransferDirection): string {
    return d === TransferDirection.Entrada ? 'Entrada' : 'Salida';
  }

  directionClasses(d: TransferDirection): string {
    return d === TransferDirection.Entrada
      ? 'text-feedback-success-text'
      : 'text-feedback-warning-text';
  }

  directionArrow(d: TransferDirection): string {
    return d === TransferDirection.Entrada ? '↓' : '↑';
  }
}
