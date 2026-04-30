import { Component, inject, signal} from '@angular/core';
import {TransferForm} from '../../dtos/tranfers/transfer-form';
import {BranchContextService} from '../../../core/auth/branch-context-service';
import {TransferService} from '../../services/transfer-service';
import {BranchDto} from '../../../core/dtos/branch-dto';
import CreateTransfer from './create-transfer/create-transfer';
import {StockTransferListDto} from '../../dtos/tranfers/stock-transfer-list-dto';
import {TransferList} from './transfer-list/transfer-list';


type TransfersView = 'list' | 'create';
@Component({
  selector: 'app-transfer-page',
  imports: [
    CreateTransfer,
    TransferList
  ],
  templateUrl: './transfer-page.html',
  styles: ``,
})
export default class TransferPage {

  private branchService   = inject(BranchContextService);
  private transferService = inject(TransferService);

  // ── Vista activa ──────────────────────────────────────────────────────────────
  view = signal<TransfersView>('list');

  // ── Branches ──────────────────────────────────────────────────────────────────
  branches        = signal<BranchDto[]>([]);
  loadingBranches = signal(false);

  // ── Transferencias ────────────────────────────────────────────────────────────
  transfers        = signal<StockTransferListDto[]>([]);
  loadingTransfers = signal(false);

  ngOnInit(): void {
    this.loadBranches();
    this.loadTransfers();
  }

  private loadBranches(): void {
    this.loadingBranches.set(true);
    this.branchService.getBranches().subscribe({
      next: branches => {
        const currentBranchId = this.branchService.active()?.branchId ?? 0;
        this.branches.set(branches.filter(b => b.id !== currentBranchId));
        this.loadingBranches.set(false);
      },
      error: () => this.loadingBranches.set(false),
    });
  }

  private loadTransfers(): void {
    this.loadingTransfers.set(true);
    this.transferService.getTransfers().subscribe({
      next: data => {
        this.transfers.set(data.items);
        console.log(data)
        this.loadingTransfers.set(false);
      },
      error: () => this.loadingTransfers.set(false),
    });
  }

  // ── Navegación ────────────────────────────────────────────────────────────────
  showCreate(): void { this.view.set('create'); }
  showList():   void { this.view.set('list');   }

  // ── Handlers de la lista ──────────────────────────────────────────────────────
  onViewDetail(id: number): void {
    // TODO: navegar al detalle
    console.log('Ver detalle:', id);
  }

  onResolve(event: { id: number; action: 'complete' | 'reject' }): void {
    this.transferService.resolveTransfer(event.id, event.action).subscribe({
      next: () => this.loadTransfers(),
      error: err => console.error('Error al resolver:string', err),
    });
  }

  onCancel(id: number): void {
    this.transferService.cancelTransfer(id).subscribe({
      next: () => this.loadTransfers(),
      error: err => console.error('Error al cancelar:', err),
    });
  }

  // ── Handler submit create ─────────────────────────────────────────────────────
  onTransferCreated(payload: TransferForm): void {
    this.transferService.createTransfer(payload).subscribe({
      next: () => {
        this.showList();
        this.loadTransfers();
      },
      error: err => console.error('Error al crear transferencia:', err),
    });
  }

}
