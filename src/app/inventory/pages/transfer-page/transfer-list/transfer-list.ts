import { Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {StockTransferListDto} from '../../../dtos/tranfers/stock-transfer-list-dto';
import {TransferDirection, TransferStatus} from '../../../dtos/tranfers/transfer-enums';
import CreateTransfer from '../create-transfer/create-transfer';


@Component({
  selector: 'app-transfer-list',
  imports: [
    DatePipe
  ],
  templateUrl: './transfer-list.html',
  styles: `
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .row-enter { animation: slide-up 220ms ease both; }

    @keyframes confirm-in {
      from { opacity: 0; transform: scaleY(0.9); }
      to   { opacity: 1; transform: scaleY(1); }
    }
    .confirm-enter { animation: confirm-in 160ms ease both; transform-origin: top; }
  `,
})
export class TransferList {
  // ── Inputs ────────────────────────────────────────────────────────────────────
  transfers       = input.required<StockTransferListDto[]>();
  loading         = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────────
  viewDetail      = output<number>();
  resolve         = output<{ id: number; action: 'complete' | 'reject' }>();
  cancel          = output<number>();

  // ── Enums expuestos al template ───────────────────────────────────────────────
  readonly Status    = TransferStatus;
  readonly Direction = TransferDirection;

  // ── Estado local de UI ────────────────────────────────────────────────────────
  /** Id del transfer con confirmación de cancelación expandida inline */
  cancelConfirmId = signal<number | null>(null);

  /** Id del transfer con el modal de resolver abierto */
  resolveModalId  = signal<number | null>(null);

  // ── Helpers de presentación ───────────────────────────────────────────────────
  statusLabel(s: TransferStatus): string {
    return ['Pendiente', 'En tránsito', 'Completada', 'Rechazada', 'Cancelada'][s];
  }

  statusClasses(s: TransferStatus): string {
    const map: Record<TransferStatus, string> = {
      [TransferStatus.Pendiente]:  'bg-amber-50  text-amber-600  ring-1 ring-amber-200',
      [TransferStatus.Transito]:   'bg-blue-50   text-blue-600   ring-1 ring-blue-200',
      [TransferStatus.Completada]: 'bg-green-50  text-green-600  ring-1 ring-green-200',
      [TransferStatus.Rechazada]:  'bg-red-50    text-red-500    ring-1 ring-red-200',
      [TransferStatus.Cancelada]:  'bg-gray-100  text-gray-400   ring-1 ring-gray-200',
    };
    return map[s];
  }

  directionLabel(d: TransferDirection): string {
    return d === TransferDirection.Entrada ? 'Entrada' : 'Salida';
  }

  directionClasses(d: TransferDirection): string {
    return d === TransferDirection.Entrada
      ? 'text-emerald-600'
      : 'text-orange-500';
  }

  directionArrow(d: TransferDirection): string {
    return d === TransferDirection.Entrada ? '↓' : '↑';
  }

  canResolve(t: StockTransferListDto): boolean {
    return t.direction === TransferDirection.Entrada
      && t.status    === TransferStatus.Pendiente;
  }

  canCancel(t: StockTransferListDto): boolean {
    return t.direction === TransferDirection.Salida
      && t.status    === TransferStatus.Pendiente;
  }

  // ── Acciones ──────────────────────────────────────────────────────────────────
  openResolveModal(id: number): void {
    this.resolveModalId.set(id);
  }

  closeResolveModal(): void {
    this.resolveModalId.set(null);
  }

  confirmResolve(action: 'complete' | 'reject'): void {
    const id = this.resolveModalId();
    if (!id) return;
    this.resolve.emit({ id, action });
    this.resolveModalId.set(null);
  }

  requestCancel(id: number): void {
    this.cancelConfirmId.set(id);
  }

  confirmCancel(id: number): void {
    this.cancel.emit(id);
    this.cancelConfirmId.set(null);
  }

  dismissCancel(): void {
    this.cancelConfirmId.set(null);
  }
}
