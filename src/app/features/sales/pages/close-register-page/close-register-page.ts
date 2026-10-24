import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { ToastService } from '@core/services/toast-service';
import { PermissionService } from '@features/auth/services/permmision-service';
import { ClosureDetailDto } from '@features/sales/dtos/closure-detail-dto';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { CloseSaleItem } from './close-sale-item/close-sale-item';
import CreateExpenseModal from '@features/sales/pages/expenses-page/create-expense-modal';
import EditExpenseModal from '@features/sales/pages/expenses-page/edit-expense-modal';
import { ConfirmActionModal } from '@features/inventory/pages/transfer-page/confirm-action-modal/confirm-action-modal';
import { MovementListDto } from '@features/sales/dtos/movement-list-dto';
import { blockNonNumericKeys } from '@shared/utils/list-query';

/** Los modales de gastos solo necesitan el movimiento sin su vínculo a la caja (el cierre no lo trae). */
type ExpenseMovement = Pick<
  MovementListDto,
  'id' | 'amount' | 'description' | 'type' | 'createdAt'
>;

@Component({
  selector: 'app-close-register-page',
  standalone: true,
  imports: [
    MoneyPipe,
    RouterLink,
    SkeletonList,
    SmartDatePipe,
    CloseSaleItem,
    CreateExpenseModal,
    EditExpenseModal,
    ConfirmActionModal,
  ],
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
  template: `
    <div class="max-w-6xl mx-auto fade-up">
      @if (state() === 'init') {
        <app-skeleton-list [rows]="3" [columns]="2" />
      } @else if (state() === 'already-closed') {
        <div
          class="flex flex-col items-center gap-3 p-12 rounded-xl border border-border bg-bg-surface shadow-xs"
        >
          <span class="material-icons text-4xl text-text-soft opacity-60">lock</span>
          <p class="text-sm font-medium text-text-muted">Esta caja ya está cerrada.</p>
          <a routerLink="/sales/pos" class="text-xs font-medium text-accent-ui hover:underline"
            >Volver al POS</a
          >
        </div>
      } @else if (state() === 'error') {
        <div
          class="flex flex-col items-center gap-3 p-12 rounded-xl border border-border bg-bg-surface shadow-xs"
        >
          <span class="material-icons text-4xl text-feedback-error-text">error_outline</span>
          <p class="text-sm font-medium text-text-muted">{{ errorMessage() }}</p>
          <a routerLink="/sales/pos" class="text-xs font-medium text-accent-ui hover:underline"
            >Volver al POS</a
          >
        </div>
      } @else {
        @let c = closure()!;
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <a routerLink="/sales/pos" class="btn-icon">
              <span class="material-icons text-base">arrow_back</span>
            </a>
            <h1 class="text-lg font-black text-text-main">Cierre de Caja</h1>
          </div>

          <div class="bg-bg-surface rounded-xl border border-border-strong px-4 py-3">
            <p class="text-sm font-semibold text-text-main">Turno #{{ c.number }}</p>
            <p class="text-xs text-text-muted mt-0.5 truncate">
              {{ c.openedAt | smartDate }} · {{ c.openedByName }} · Apertura
              {{ c.openingBalance | money }}
            </p>

            <div
              class="grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-2 mt-2 pt-2 border-t border-border"
            >
              <div>
                <p class="table-header">Ventas</p>
                <p class="text-base font-black text-text-main font-mono">
                  {{ c.totalSales | money }}
                </p>
              </div>
              <div>
                <p class="table-header">Efectivo</p>
                <p class="text-base font-black text-text-main font-mono">
                  {{ c.cashSales | money }}
                </p>
              </div>
              <div>
                <p class="table-header">QR</p>
                <p class="text-base font-black text-text-main font-mono">
                  {{ c.qrSales | money }}
                </p>
              </div>
              <div>
                <p class="table-header">Gastos</p>
                <p class="text-base font-black text-feedback-error-text font-mono">
                  {{ c.totalExpenses | money }}
                </p>
              </div>
              <div>
                <p class="table-header">Esperado</p>
                <p class="text-base font-black text-accent-ui font-mono">
                  {{ expectedAmount() | money }}
                </p>
              </div>
            </div>
          </div>

          @if (c.sales.length > 0) {
            <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
              <div class="px-6 pt-5 pb-3">
                <p class="text-[11px] font-bold uppercase tracking-wider text-text-soft">
                  Ventas del turno ({{ c.sales.length }})
                </p>
              </div>
              <div
                class="hidden lg:grid lg:grid-cols-[12rem_8rem_6rem_7rem_5rem_8rem] px-6 py-2 bg-bg-muted border-y border-border text-[10px] font-bold uppercase tracking-wider text-text-soft"
              >
                <span>Hora</span>
                <span class="text-right">Monto</span>
                <span class="text-center">Tipo</span>
                <span class="text-center">Pago</span>
                <span class="text-right">Art.</span>
                <span></span>
              </div>
              <ul class="flex flex-col divide-y divide-border">
                @for (sale of c.sales; track sale.id) {
                  <li app-close-sale-item [sale]="sale"></li>
                }
              </ul>
            </div>
          }

          <div class="bg-bg-surface rounded-xl border border-border-strong overflow-hidden">
            <div class="px-6 pt-5 pb-3 flex items-center justify-between gap-3">
              <p class="section-title mb-0">Gastos del turno ({{ c.movements.length }})</p>
              @if (perm.can('sales', 'pos', 'create')) {
                <button
                  type="button"
                  (click)="isCreateExpenseOpen.set(true)"
                  class="btn-primary btn-sm"
                >
                  <span class="material-icons !text-[15px]">add</span>
                  Registrar gasto
                </button>
              }
            </div>
            @if (c.movements.length > 0) {
              <div
                class="hidden lg:grid lg:grid-cols-[7rem_1fr_7rem_6rem_5rem] px-6 py-2 bg-bg-muted border-y border-border text-[10px] font-bold uppercase tracking-wider text-text-soft"
              >
                <span>Tipo</span>
                <span>Descripción</span>
                <span class="text-right">Monto</span>
                <span class="text-right">Hora</span>
                <span class="text-right">Acciones</span>
              </div>
              <ul class="flex flex-col">
                @for (m of c.movements; track m.id) {
                  <li class="bg-bg-surface">
                    <!-- Móvil: descripción + saldo + acciones -->
                    <div class="flex items-center gap-4 px-6 py-3.5 lg:hidden">
                      <div class="flex flex-col min-w-0 flex-1">
                        <p class="text-sm font-semibold text-text-main">{{ m.description }}</p>
                        <p class="mt-0.5 text-xs text-text-muted">
                          <span
                            [class.text-feedback-error-text]="m.type === 'Outflow'"
                            [class.text-feedback-success-text]="m.type !== 'Outflow'"
                          >
                            {{ m.type === 'Outflow' ? 'Salida' : 'Entrada' }}
                          </span>
                          <span class="mx-1">·</span>
                          {{ m.createdAt | smartDate }}
                        </p>
                        @if (
                          perm.can('sales', 'pos', 'update') || perm.can('sales', 'pos', 'delete')
                        ) {
                          <div class="flex items-center gap-3 mt-2">
                            @if (perm.can('sales', 'pos', 'update')) {
                              <button
                                type="button"
                                (click)="openEdit(m)"
                                class="action-text action-text--edit"
                              >
                                Editar
                              </button>
                            }
                            @if (perm.can('sales', 'pos', 'delete')) {
                              <button
                                type="button"
                                (click)="openDelete(m)"
                                class="action-text action-text--delete"
                              >
                                Eliminar
                              </button>
                            }
                          </div>
                        }
                      </div>
                      <div class="shrink-0 text-right">
                        <span
                          class="text-sm font-mono font-bold"
                          [class.text-feedback-error-text]="m.type === 'Outflow'"
                          [class.text-feedback-success-text]="m.type !== 'Outflow'"
                        >
                          {{ (m.type === 'Outflow' ? -m.amount : m.amount) | money }}
                        </span>
                      </div>
                    </div>
                    <!-- Desktop: fila de tabla con acciones -->
                    <div
                      class="hidden lg:grid lg:grid-cols-[7rem_1fr_7rem_6rem_5rem] items-center px-6 py-3 hover:bg-bg-muted/30"
                    >
                      <span>
                        <span
                          class="text-[11px] font-bold px-2 py-0.5 rounded-md"
                          [class.text-feedback-error-text]="m.type === 'Outflow'"
                          [class.bg-feedback-error-bg]="m.type === 'Outflow'"
                          [class.text-feedback-success-text]="m.type !== 'Outflow'"
                          [class.bg-feedback-success-bg]="m.type !== 'Outflow'"
                        >
                          {{ m.type === 'Outflow' ? 'Salida' : 'Entrada' }}
                        </span>
                      </span>
                      <span class="text-[13px] text-text-main truncate pr-4">{{
                        m.description
                      }}</span>
                      <span
                        class="text-right text-[13px] font-mono font-bold"
                        [class.text-feedback-error-text]="m.type === 'Outflow'"
                        [class.text-feedback-success-text]="m.type !== 'Outflow'"
                      >
                        {{ (m.type === 'Outflow' ? -m.amount : m.amount) | money }}
                      </span>
                      <span class="text-right text-[13px] text-text-soft">{{
                        m.createdAt | smartDate
                      }}</span>
                      <span class="flex justify-end items-center gap-1">
                        @if (perm.can('sales', 'pos', 'update')) {
                          <button
                            (click)="openEdit(m)"
                            class="action-btn action-btn--edit"
                            title="Editar"
                          >
                            <span class="material-icons text-base">edit</span>
                          </button>
                        }
                        @if (perm.can('sales', 'pos', 'delete')) {
                          <button
                            (click)="openDelete(m)"
                            class="action-btn action-btn--delete"
                            title="Eliminar"
                          >
                            <span class="material-icons text-base">delete</span>
                          </button>
                        }
                        @if (
                          !perm.can('sales', 'pos', 'update') && !perm.can('sales', 'pos', 'delete')
                        ) {
                          <span class="text-xs text-text-soft">—</span>
                        }
                      </span>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <div class="px-6 py-8 flex flex-col items-center gap-2 text-center">
                <span class="material-icons text-3xl text-text-soft opacity-50">receipt_long</span>
                <p class="text-sm font-semibold text-text-main">Sin gastos en este turno</p>
                <p class="text-xs text-text-soft max-w-xs">
                  Si retirás efectivo o pagás algo en efectivo, registralo acá para que el arqueo
                  dé.
                </p>
              </div>
            }
          </div>

          @if (perm.can('sales', 'closures', 'update')) {
            <div class="bg-bg-surface rounded-xl border border-border-strong px-6 py-5">
              <p class="section-title mb-4">Cerrar turno</p>
              <div class="flex flex-col gap-4">
                <div class="flex flex-col sm:flex-row gap-4 items-start">
                  <div class="flex-1 max-w-xs">
                    <label class="field-label">Monto contado en caja</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      [value]="closingBalance() ?? ''"
                      (input)="onBalanceInput($any($event.target).value)"
                      (keydown)="blockKeys($event)"
                      class="field-number w-full px-4 py-2.5 text-lg font-mono font-bold border border-border rounded-xl bg-bg-surface text-text-main focus:outline-none focus:border-accent-ui"
                    />
                  </div>
                  <div
                    class="flex-1 bg-accent-ui/10 border border-accent-ui/30 rounded-xl px-4 py-3 flex flex-col gap-1"
                  >
                    <span class="text-[11px] font-bold uppercase tracking-wider text-accent-ui"
                      >Esperado</span
                    >
                    <span class="text-xl font-black font-mono text-accent-ui">{{
                      expectedAmount() | money
                    }}</span>
                    @if (closingBalance() !== null) {
                      <span
                        class="text-xs font-mono"
                        [class.text-feedback-success-text]="
                          closingBalance()! - expectedAmount() === 0
                        "
                        [class.text-feedback-error-text]="
                          closingBalance()! - expectedAmount() !== 0
                        "
                      >
                        Dif: {{ closingBalance()! - expectedAmount() | money }}
                      </span>
                    }
                  </div>
                </div>
                <div class="flex gap-3">
                  <a routerLink="/sales/pos" class="btn-secondary"> Cancelar </a>
                  <button
                    type="button"
                    (click)="confirmClose()"
                    [disabled]="closingBalance() === null || closingBalance()! < 0 || submitting()"
                    class="btn-primary disabled:opacity-40 flex items-center gap-2"
                  >
                    @if (submitting()) {
                      <span
                        class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      ></span>
                    }
                    Confirmar Cierre
                  </button>
                </div>
                @if (closeError()) {
                  <p class="text-sm text-feedback-error-text">{{ closeError() }}</p>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- CRUD de gastos del turno (bottom-sheet en mobile, centrado en desktop) -->
    @if (isCreateExpenseOpen()) {
      <app-create-expense-modal (saved)="loadClosure()" (close)="isCreateExpenseOpen.set(false)" />
    }
    @if (editTarget(); as em) {
      <app-edit-expense-modal
        [movement]="em"
        (saved)="loadClosure()"
        (close)="editTarget.set(null)"
      />
    }
    @if (deleteTarget(); as dt) {
      <app-confirm-action-modal
        title="¿Eliminar gasto?"
        [description]="deleteDescription()"
        confirmLabel="Eliminar"
        submittingLabel="Eliminando..."
        [submitting]="deleting()"
        (confirm)="confirmDelete()"
        (close)="deleteTarget.set(null)"
      />
    }
  `,
})
export default class CloseRegisterPage implements OnInit {
  private router = inject(Router);
  private cashRegisterService = inject(CashRegisterService);
  private toast = inject(ToastService);
  readonly perm = inject(PermissionService);
  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;

  state = signal<'init' | 'ready' | 'already-closed' | 'error'>('init');
  closure = signal<ClosureDetailDto | null>(null);
  closingBalance = signal<number | null>(null);
  submitting = signal(false);
  closeError = signal<string | null>(null);
  errorMessage = signal('');

  /** CRUD de gastos del turno: los modales ya existían y se comparten. */
  isCreateExpenseOpen = signal(false);
  editTarget = signal<ExpenseMovement | null>(null);
  deleteTarget = signal<ExpenseMovement | null>(null);
  deleting = signal(false);

  expectedAmount = computed(() => {
    const c = this.closure();
    if (!c) return 0;
    return c.openingBalance + c.cashSales - c.totalExpenses;
  });

  ngOnInit(): void {
    this.loadClosure();
  }

  loadClosure(): void {
    this.cashRegisterService.getCurrentDetails().subscribe({
      next: (c) => {
        this.closure.set(c);
        this.state.set('ready');
      },
      error: (err) => {
        if (err?.status === 404) {
          this.state.set('already-closed');
          return;
        }
        this.errorMessage.set('Error al cargar los datos del turno.');
        this.state.set('error');
      },
    });
  }

  onBalanceInput(value: string): void {
    if (value === '' || value === null || value === undefined) {
      this.closingBalance.set(null);
      return;
    }
    const num = Number(value);
    this.closingBalance.set(Number.isFinite(num) ? num : null);
  }

  openEdit(m: ExpenseMovement): void {
    if (!this.perm.can('sales', 'pos', 'update')) return;
    this.editTarget.set(m);
  }

  deleteDescription = (): string => {
    const t = this.deleteTarget();
    if (!t) return '';
    return `Se eliminará "${t.description}" por Bs ${t.amount.toFixed(2)}. Esta acción no se puede deshacer.`;
  };

  openDelete(m: ExpenseMovement): void {
    if (!this.perm.can('sales', 'pos', 'delete')) return;
    this.deleteTarget.set(m);
  }

  confirmDelete(): void {
    const m = this.deleteTarget();
    if (!m) return;
    this.deleting.set(true);
    this.cashRegisterService.deleteMovement(m.id).subscribe({
      next: () => {
        this.toast.success('Gasto eliminado');
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.loadClosure();
      },
      error: (err) => {
        this.deleting.set(false);
        this.toast.error(
          (err as { error?: { detail?: string; title?: string }; message?: string })?.error
            ?.detail ||
            (err as { message?: string })?.message ||
            'Error al eliminar el gasto',
        );
      },
    });
  }

  confirmClose(): void {
    const bal = this.closingBalance();
    if (bal === null || bal < 0 || !Number.isFinite(bal) || this.submitting()) return;

    this.submitting.set(true);
    this.closeError.set(null);

    this.cashRegisterService.closeRegister({ RealCountedAmount: bal! }).subscribe({
      next: () => {
        this.toast.success('Caja cerrada');
        this.router.navigate(['/sales/pos']);
      },
      error: (err) => {
        this.submitting.set(false);
        const e = err as {
          error?: { detail?: string; title?: string; message?: string };
          message?: string;
        };
        const msg =
          e?.error?.detail ||
          e?.error?.title ||
          e?.error?.message ||
          e?.message ||
          'Error al cerrar la caja. Intentá de nuevo.';
        this.closeError.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
