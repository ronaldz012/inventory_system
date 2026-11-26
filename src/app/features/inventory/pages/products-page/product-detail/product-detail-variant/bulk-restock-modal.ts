import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { form, required } from '@angular/forms/signals';
import {
  Subject,
  Observable,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MoneyPipe } from '@shared/pipes/money-pipe';
import { blockNonNumericKeys } from '@shared/utils/list-query';
import { GridNavDirective } from '@shared/directives/grid-nav.directive';
import { ToastService } from '@core/services/toast-service';
import { ModalStackService, useStackedModal } from '@core/modal-stack-service';
import ProviderSelectCtrl from '@features/inventory/components/provider-select-ctrl/provider-select-ctrl';
import { ReceptionService } from '../../../../services/reception-service';
import { ProviderService } from '../../../../services/provider-service';
import CreateReceptionDto from '../../../../dtos/receptions/create-reception-dto';
import {
  ReceptionStatus,
  StockReceptionListDto,
} from '../../../../dtos/receptions/stock-reception-list-dto';
import {
  MIN_UNIT_COST,
  StockReceptionDetailDto,
  StockReceptionItemDetailDto,
} from '../../../../dtos/receptions/stock-reception-details-dto';
import { AddDraftItemDto } from '../../../../dtos/receptions/add-draft-items-dto';
import { ProductVariantDto } from '../../../../dtos/products/product-detail-dto';
import { PagedResult } from '../../../../dtos/paged-result';

/** Lo que el panel devuelve a la página para el POST de ítems. */
export interface BulkRestockPayload {
  receptionId: GUID;
  items: AddDraftItemDto[];
}

interface RestockRow {
  id: GUID;
  sku: string;
  size: string;
  colorId: GUID;
  colorName: string;
  sizeOrder: number;
  /** Stock en la sucursal activa — interno: alimenta el aviso de transferencia. */
  stock: number;
  /** Stock en todas las sucursales visibles — la señal para decidir cuánto pedir. */
  totalAvailable: number;
  /** Cantidad que ya tiene el borrador (null = la variante no está). */
  existingQty: number | null;
  /** Costo que ya tiene el borrador (null = la variante no está). */
  existingCost: number | null;
  /** Último costo de compra del producto; 0/null si nunca se compró. */
  lastPurchaseCost: number | null;
  /** Cantidad A AGREGAR: el backend suma, no reemplaza. */
  qty: number | null;
}

interface ColorGroup {
  colorId: GUID;
  colorName: string;
  /** Stock total (sucursales visibles) del color. */
  total: number;
  units: number;
  rows: RestockRow[];
}

/** Resumen del contenido actual del borrador (del detalle, no del listado). */
interface DraftSummary {
  count: number;
  units: number;
  cost: number;
}

interface RestockDraft {
  id: GUID;
  number: number;
  providerName: string;
  notes?: string;
  receivedAt: Date | string;
  productVariantsCount: number;
  totalItems: number;
  totalCost: number;
}

const PAGE_SIZE = 10;

/**
 * "Reponer": agrega variantes existentes a un borrador de recepción.
 *
 *  - Paso 1: buscar borrador (backend `filter`, 10 resultados, click directo)
 *            o crear uno nuevo con Proveedor + Notas (se crea al instante y
 *            queda "suelto" si se abandona).
 *  - Paso 2: SOLO cantidades, agrupadas por color. El costo no se decide acá:
 *            se envía el último de compra (o 0) y se revisa al confirmar.
 *
 * El backend hace upsert: si la variante ya está en el borrador, SUMA la
 * cantidad. Un costo conocido existente nunca se pisa (se manda 0).
 */
@Component({
  selector: 'app-bulk-restock-modal',
  imports: [DatePipe, MoneyPipe, ProviderSelectCtrl, GridNavDirective],
  template: `
    <div
      class="fixed inset-y-0 right-0 z-[100] flex flex-col bg-bg-surface font-inter animate-fade-in w-full md:w-[640px] md:max-w-[95%] md:border-l md:border-border md:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.15)]"
    >
      <!-- ── HEADER ── -->
      <header
        class="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          @if (step() === 2) {
            <button
              type="button"
              (click)="backToDraftList()"
              [disabled]="submitting()"
              class="btn-icon -ml-1 hover:bg-bg-muted hover:text-text-main disabled:opacity-40"
              aria-label="Cambiar borrador"
              title="Cambiar borrador"
            >
              <span class="material-icons text-base">arrow_back</span>
            </button>
          }
          <span class="pill-info">Reponer</span>
          <span class="text-[13px] font-semibold text-text-main truncate">
            @if (step() === 1) {
              Elegir borrador
            } @else {
              #{{ selectedDraft()?.number }} ·
              {{ selectedDraft()?.providerName || 'Sin proveedor' }}
            }
          </span>
        </div>
        <button
          type="button"
          (click)="close.emit()"
          [disabled]="submitting()"
          class="btn-icon hover:bg-bg-muted hover:text-text-main disabled:opacity-40"
          aria-label="Cerrar panel"
        >
          <span class="material-icons text-base">close</span>
        </button>
      </header>

      <!-- ── MAIN ── -->
      <main class="flex-1 overflow-y-auto p-4 space-y-4">
        <p class="flex items-center gap-1.5 text-[11px] text-text-soft">
          <span class="material-icons text-[14px] leading-none">store</span>
          Destino:
          <span class="font-semibold text-text-main">{{ branchName() }}</span>
        </p>

        @if (!productActive()) {
          <div
            class="rounded-xl border border-feedback-warning/40 bg-feedback-warning/10 px-3 py-2 text-xs font-medium text-feedback-warning-text"
          >
            Este producto está inactivo: no se pueden agregar sus tallas/colores a una recepción.
          </div>
        }

        <!-- ══════════ PASO 1 · BUSCAR / ELEGIR BORRADOR ══════════ -->
        @if (step() === 1) {
          <div class="flex items-center gap-2">
            <div class="relative flex-1 min-w-0">
              <span
                class="material-icons absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-text-soft pointer-events-none"
                >search</span
              >
              <input
                type="search"
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                placeholder="Buscar #, proveedor, marca o notas…"
                aria-label="Buscar borrador"
                class="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-surface text-text-main placeholder:text-text-soft focus:outline-none focus:border-accent-ui focus:ring-2 focus:ring-accent-ui/20"
              />
            </div>
            <button
              type="button"
              (click)="openCreateDraft()"
              [disabled]="!productActive()"
              class="btn btn-secondary btn-sm shrink-0 gap-1 disabled:opacity-40"
              title="Crear un borrador nuevo"
            >
              <span class="material-icons text-base leading-none">add</span>
              Nuevo
            </button>
          </div>

          @if (loadingDrafts()) {
            <div class="flex items-center gap-2 py-8 justify-center text-sm text-text-muted">
              <span class="material-icons animate-spin text-base">progress_activity</span>
              Buscando borradores…
            </div>
          } @else if (draftsError()) {
            <div
              class="rounded-xl border border-feedback-error/40 bg-feedback-error/10 p-3 space-y-2"
            >
              <p class="text-xs font-medium text-feedback-error-text">{{ draftsError() }}</p>
              <button type="button" (click)="loadDefaults()" class="btn btn-secondary btn-sm">
                Reintentar
              </button>
            </div>
          } @else if (drafts().length === 0) {
            <div class="py-10 text-center space-y-3">
              <span class="material-icons text-3xl text-text-soft">inventory_2</span>
              @if (searchQuery().trim()) {
                <p class="text-sm font-medium text-text-main">
                  Sin resultados para «{{ searchQuery().trim() }}»
                </p>
                <button type="button" (click)="clearSearch()" class="btn btn-secondary btn-sm">
                  Limpiar búsqueda
                </button>
              } @else {
                <p class="text-sm font-medium text-text-main">
                  No hay borradores en {{ branchName() }}
                </p>
                <p class="text-xs text-text-soft max-w-[18rem] mx-auto">
                  Creá un borrador con proveedor y notas; después le agregás las cantidades.
                </p>
                <button
                  type="button"
                  (click)="openCreateDraft()"
                  [disabled]="!productActive()"
                  class="btn btn-primary btn-sm disabled:opacity-40"
                >
                  Crear borrador
                </button>
              }
            </div>
          } @else {
            <div class="space-y-2">
              @for (d of drafts(); track d.id) {
                <button
                  type="button"
                  (click)="selectDraft(d)"
                  class="w-full text-left rounded-xl border px-3 py-2.5 transition-colors border-border bg-bg-surface hover:bg-bg-muted/50"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-mono font-bold text-[13px] text-accent-ui">
                      #{{ d.number }}
                    </span>
                    <span class="text-[11px] text-text-soft">
                      {{ d.receivedAt | date: 'dd/MM/yy' }}
                    </span>
                  </div>
                  <div class="truncate font-medium text-sm text-text-main">
                    {{ d.providerName || 'Sin proveedor' }}
                  </div>
                  @if (d.notes) {
                    <div class="truncate text-[11px] text-text-soft italic">{{ d.notes }}</div>
                  }
                  <div class="text-[11px] text-text-muted tabular-nums">
                    {{ d.productVariantsCount }}
                    {{ d.productVariantsCount === 1 ? 'talla/color' : 'tallas/colores' }}
                    · {{ d.totalItems }} uds · {{ d.totalCost | money: 'symbol' }}
                  </div>
                  @if (selectedReceptionId() === d.id && loadingDetail()) {
                    <div class="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted">
                      <span class="material-icons animate-spin text-[13px]">progress_activity</span>
                      Buscando qué tallas ya están…
                    </div>
                  }
                </button>
              }
            </div>

            @if (totalDrafts() > drafts().length) {
              <p class="text-center text-[11px] text-text-soft">
                Mostrando {{ drafts().length }} de {{ totalDrafts() }} — buscá para acotar.
              </p>
            }

            @if (detailError()) {
              <div
                class="rounded-xl border border-feedback-error/40 bg-feedback-error/10 p-3 space-y-2"
              >
                <p class="text-xs font-medium text-feedback-error-text">{{ detailError() }}</p>
                <button
                  type="button"
                  (click)="retryDetail()"
                  class="btn btn-secondary btn-sm"
                  [disabled]="!selectedReceptionId()"
                >
                  Reintentar
                </button>
              </div>
            }
          }
        }

        <!-- ══════════ PASO 2 · CANTIDADES (agrupadas por color) ══════════ -->
        @if (step() === 2) {
          <!-- Qué tiene hoy el borrador elegido (del detalle, no del listado) -->
          @if (draftSummary(); as s) {
            <p class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-text-soft">
              @if (s.count === 0) {
                Borrador vacío — lo que cargués acá será lo primero.
              } @else {
                Ya tiene
                <strong class="text-text-main tabular-nums">{{ s.count }}</strong>
                {{ s.count === 1 ? 'talla/color' : 'tallas/colores' }} ·
                <strong class="text-text-main tabular-nums">{{ s.units }}</strong>
                uds ·
                <strong class="font-mono text-text-main">{{ s.cost | money: 'symbol' }}</strong>
              }
            </p>
          }

          <section class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="section-title !mb-0">Tallas/colores a reponer</h3>
              <p class="text-[10px] text-text-soft">Total = todas las sucursales visibles</p>
            </div>

            <!-- Sin stock acá pero con stock en otra sucursal: mejor transferir. -->
            @if (transferHint(); as th) {
              <div
                class="rounded-xl border border-feedback-info/50 bg-feedback-info px-3 py-2 flex items-start gap-2"
              >
                <span class="material-icons text-base text-feedback-info-text shrink-0"
                  >swap_horiz</span
                >
                <p class="text-[11px] leading-snug text-feedback-info-text">
                  <strong>{{ th.count }}</strong>
                  {{ th.count === 1 ? 'talla no tiene' : 'tallas no tienen' }} stock en
                  {{ branchName() }}, pero hay <strong>{{ th.units }} uds</strong> en otras
                  sucursales. Para esos casos conviene una transferencia en vez de reponer.
                </p>
              </div>
            }

            <!-- Cantidad masiva: misma herramienta que el "compra masivo" del catálogo -->
            <div
              class="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-bg-muted/60 px-3 py-1.5 rounded-lg border border-border"
            >
              <span class="text-[10px] font-medium text-text-soft uppercase tracking-wider"
                >Cantidad para todas:</span
              >
              <div class="flex items-center gap-1.5">
                <input
                  type="number"
                  inputmode="numeric"
                  min="1"
                  step="1"
                  [value]="masterQty() ?? ''"
                  (input)="onMasterQtyInput($event)"
                  (keydown)="blockKeys($event)"
                  placeholder="1"
                  aria-label="Cantidad para todas"
                  class="field-number w-20 px-1.5 py-0.5 border border-border rounded text-[11px] font-mono text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui"
                />
                <button
                  type="button"
                  (click)="applyMasterQty()"
                  [disabled]="masterQty() == null"
                  class="btn btn-secondary btn-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Aplicar
                </button>
              </div>
            </div>

            <!-- Misma tabla que el catálogo: grupos por color + grilla desktop / 2 filas mobile -->
            <div class="border border-border rounded-xl bg-bg-surface shadow-sm">
              <div
                class="hidden md:grid grid-cols-[minmax(72px,1fr)_56px_56px_80px_72px_64px_28px] bg-bg-muted border-b border-border sticky top-0 z-10"
              >
                <div class="px-3 py-1.5 table-header">Código</div>
                <div class="px-3 py-1.5 table-header">Talla</div>
                <div class="px-3 py-1.5 table-header text-right">Total</div>
                <div
                  class="px-2 py-1.5 table-header text-right leading-tight"
                  title="Unidades que este borrador ya tiene de la variante"
                >
                  En recepción
                </div>
                <div class="px-3 py-1.5 table-header text-right">Cant.</div>
                <div
                  class="px-3 py-1.5 table-header text-right whitespace-nowrap"
                  title="Total de la variante si confirmás este borrador (Total + En recepción + Cant.)"
                >
                  Después
                </div>
                <div class="px-3 py-1.5"></div>
              </div>

              <!-- Grilla navegable: ↑↓ bajan de casilla (como el catálogo), no steppean. -->
              <div class="flex flex-col" appGridNav>
                @for (group of groups(); track group.colorId) {
                  <div class="table-group-header">
                    <span class="text-[12px] font-bold text-text-main truncate">
                      {{ group.colorName }}
                    </span>
                    <span
                      class="ml-auto text-[11px] text-text-soft tabular-nums shrink-0"
                      title="Stock total del color (todas las sucursales visibles)"
                    >
                      Total {{ group.total }}
                    </span>
                    <span class="text-[11px] font-bold text-accent-ui tabular-nums shrink-0">
                      +{{ group.units }} uds
                    </span>
                  </div>

                  @for (row of group.rows; track row.id) {
                    <div
                      data-nav-row
                      class="flex flex-col md:grid md:grid-cols-[minmax(72px,1fr)_56px_56px_80px_72px_64px_28px] md:items-center border-b border-border last:border-b-0 transition-colors focus-within:bg-accent-ui/5"
                    >
                      <!-- Mobile fila 1: identidad (el color lo da el grupo) -->
                      <div class="flex items-center gap-2 px-3 py-1.5 md:p-0 md:contents">
                        <div
                          class="text-[11px] font-mono text-text-main truncate min-w-0 flex-1 md:flex-none md:px-3 md:py-1"
                        >
                          {{ row.sku }}
                        </div>
                        <div class="text-[11px] text-text-main truncate shrink-0 md:px-3 md:py-1">
                          {{ row.size }}
                        </div>
                      </div>

                      <!-- Mobile fila 2: números -->
                      <div
                        class="flex flex-wrap items-center gap-2 px-3 py-1.5 border-t border-border/40 md:border-t-0 md:p-0 md:contents"
                      >
                        <!-- Total en las sucursales visibles -->
                        <div
                          class="flex flex-wrap items-center gap-1 flex-1 md:block md:px-2 md:py-1 md:text-right"
                        >
                          <span class="text-[9px] font-semibold uppercase text-text-soft md:hidden"
                            >Total</span
                          >
                          <span
                            class="text-[11px] font-mono font-semibold tabular-nums text-text-main"
                          >
                            {{ row.totalAvailable }}
                          </span>
                        </div>

                        <!-- Lo que este borrador ya tiene de la variante -->
                        <div
                          class="flex flex-wrap items-center gap-1 flex-1 md:block md:px-2 md:py-1 md:text-right"
                          title="Unidades que este borrador ya tiene de la variante"
                        >
                          <span class="text-[9px] font-semibold uppercase text-text-soft md:hidden"
                            >En recepción</span
                          >
                          <span
                            class="text-[11px] font-mono font-semibold tabular-nums"
                            [class]="row.existingQty != null ? 'text-accent-ui' : 'text-text-soft'"
                          >
                            {{ row.existingQty ?? '—' }}
                          </span>
                        </div>

                        <!-- Cantidad a agregar (el merge va debajo, como los errores del catálogo) -->
                        <div
                          class="flex flex-wrap items-center gap-1 flex-1 md:block md:px-2 md:py-1"
                        >
                          <span class="text-[9px] font-semibold uppercase text-text-soft md:hidden"
                            >Cant.</span
                          >
                          <input
                            type="number"
                            inputmode="numeric"
                            data-nav-field="qty"
                            min="1"
                            step="1"
                            [value]="row.qty ?? ''"
                            (input)="onQtyInput(row, $event)"
                            [class.!border-feedback-error-text]="row.qty == null"
                            [attr.aria-label]="'Cantidad a agregar de ' + row.sku"
                            class="field-number flex-1 min-w-0 w-full px-1.5 py-0.5 border border-border rounded text-[11px] font-mono font-bold text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui focus:ring-2 focus:ring-accent-ui/20"
                          />
                        </div>

                        <!-- Total proyectado si el borrador se confirma -->
                        <div
                          class="flex flex-wrap items-center gap-1 flex-1 md:block md:px-2 md:py-1 md:text-right"
                          title="Total de la variante si confirmás este borrador"
                        >
                          <span class="text-[9px] font-semibold uppercase text-text-soft md:hidden"
                            >Después</span
                          >
                          <span
                            class="text-[11px] font-mono font-bold tabular-nums"
                            [class]="
                              totalAfter(row) > row.totalAvailable
                                ? 'text-accent-ui'
                                : 'text-text-muted'
                            "
                          >
                            {{ totalAfter(row) }}
                          </span>
                        </div>

                        <!-- Quitar de la selección -->
                        <button
                          type="button"
                          (click)="removeRow(row.id)"
                          class="btn-icon !h-6 !w-6 shrink-0 hover:bg-feedback-error/10 hover:text-feedback-error-text md:justify-self-end"
                          [attr.aria-label]="'Quitar ' + row.sku"
                          title="Quitar de la selección"
                        >
                          <span class="material-icons text-[14px]">close</span>
                        </button>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </section>

          <p class="text-[11px] text-text-soft">
            Los costos se toman del último de compra de cada variante y se completan al confirmar la
            recepción.
          </p>
        }
      </main>

      <!-- ── FOOTER ── -->
      <footer
        class="border-t border-border bg-bg-surface p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0"
      >
        <div class="w-full mx-auto flex flex-wrap items-center justify-end gap-3">
          @if (step() === 1) {
            <span class="text-[11px] text-text-muted mr-auto">
              {{ variants().length }}
              {{
                variants().length === 1
                  ? 'talla/color seleccionada'
                  : 'tallas/colores seleccionadas'
              }}
              para reponer.
            </span>
            <button
              type="button"
              (click)="close.emit()"
              [disabled]="submitting()"
              class="btn btn-secondary btn-sm disabled:opacity-40"
            >
              Cancelar
            </button>
          } @else {
            <span class="text-[11px] text-text-muted mr-auto tabular-nums">
              Total: {{ selectionTotal() }}
              <span class="material-icons text-[12px] align-middle text-text-soft"
                >arrow_forward</span
              >
              <strong class="text-text-main">{{ selectionTotal() + totalUnits() }}</strong>
              ·
              <strong class="text-text-main">{{ totalUnits() }}</strong>
              {{ totalUnits() === 1 ? 'nueva' : 'nuevas' }}
              @if (pendingCosts() > 0) {
                ·
                <span class="font-bold text-feedback-warning-text">
                  {{ pendingCosts() }} con costo pendiente
                </span>
              }
            </span>
            <button
              type="button"
              (click)="backToDraftList()"
              [disabled]="submitting()"
              class="btn btn-secondary btn-sm disabled:opacity-40"
            >
              Volver
            </button>
            <button
              type="button"
              (click)="onSave()"
              [disabled]="!canSave() || submitting()"
              class="btn btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              @if (submitting()) {
                Agregando...
              } @else {
                Agregar al borrador
              }
            </button>
            @if (!canSave() && !submitting()) {
              <span class="w-full text-right text-[11px] font-medium text-feedback-warning-text">
                {{ saveHint() }}
              </span>
            }
          }
        </div>
      </footer>

      <!-- ── DIÁLOGO: NUEVO BORRADOR (sobre el panel) ── -->
      @if (showCreateDraft()) {
        <div
          class="absolute inset-0 z-30 bg-overlay flex items-center justify-center p-4"
          (click)="closeCreateDraft()"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo borrador"
            class="w-full max-w-sm bg-bg-surface rounded-2xl border border-border shadow-xl p-4 space-y-3"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <h2 class="text-sm font-bold text-text-main">Nuevo borrador</h2>
                <p class="text-[11px] text-text-soft">
                  Se crea ahora y queda guardado aunque cierres el panel.
                </p>
              </div>
              <button
                type="button"
                (click)="closeCreateDraft()"
                [disabled]="createSaving()"
                class="btn-icon hover:bg-bg-muted hover:text-text-main disabled:opacity-40"
                aria-label="Cerrar"
              >
                <span class="material-icons text-base">close</span>
              </button>
            </div>

            <app-provider-select-ctrl
              [fieldId]="createForm.id()"
              [fieldName]="createForm.name()"
              placeholder="Proveedor *"
            />

            <input
              type="text"
              [value]="createNotes()"
              (input)="onCreateNotesInput($event)"
              placeholder="Notas (opcional)"
              aria-label="Notas del borrador"
              class="w-full px-3 py-1.5 border border-border bg-bg-surface rounded-lg text-sm text-text-main placeholder:text-text-soft focus:outline-none focus:ring-1 focus:ring-accent-ui focus:border-accent-ui"
            />

            @if (createError()) {
              <p class="text-[11px] font-medium text-feedback-error-text">{{ createError() }}</p>
            }

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                (click)="closeCreateDraft()"
                [disabled]="createSaving()"
                class="btn btn-secondary btn-sm disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="createDraft()"
                [disabled]="createSaving()"
                class="btn btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                @if (createSaving()) {
                  Creando...
                } @else {
                  Crear borrador
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class BulkRestockModal implements OnInit, OnDestroy {
  private receptionService = inject(ReceptionService);
  private providerService = inject(ProviderService);
  private toast = inject(ToastService);
  private stack = inject(ModalStackService);
  private destroyRef = inject(DestroyRef);
  private search$ = new Subject<string>();

  /** Variantes seleccionadas en la lista (la selección vive afuera). */
  variants = input.required<ProductVariantDto[]>();
  activeBranchId = input.required<GUID | null>();
  branchName = input<string>('Sucursal activa');
  productActive = input<boolean>(true);
  submitting = input<boolean>(false);

  save = output<BulkRestockPayload>();
  close = output<void>();

  readonly step = signal<1 | 2>(1);

  /** Umbral de costo para confirmar — marca los ítems que quedarían en 0. */
  readonly MIN_UNIT_COST = MIN_UNIT_COST;

  /** El template no puede llamar imports: se expone el helper tal cual. */
  readonly blockKeys = blockNonNumericKeys;

  drafts = signal<RestockDraft[]>([]);
  totalDrafts = signal(0);
  loadingDrafts = signal(false);
  draftsError = signal<string | null>(null);
  searchQuery = signal('');

  selectedReceptionId = signal<GUID | null>(null);
  loadingDetail = signal(false);
  detailError = signal<string | null>(null);

  rows = signal<RestockRow[]>([]);
  masterQty = signal<number | null>(null);

  /** Qué tiene hoy el borrador elegido (se recalcula al cargar su detalle). */
  draftSummary = signal<DraftSummary>({ count: 0, units: 0, cost: 0 });

  // ── Diálogo "Nuevo borrador" ───────────────────────────────────────────
  showCreateDraft = signal(false);
  createSaving = signal(false);
  createError = signal<string | null>(null);
  createNotes = signal('');
  createModel = signal<{ id: GUID | null; name: string }>({ id: null, name: '' });
  createForm = form(this.createModel, (s) => {
    required(s.id, { message: 'Seleccioná un proveedor' });
  });
  private createDraftModal = useStackedModal(
    this.stack,
    this.showCreateDraft,
    () => !this.createSaving(),
  );

  selectedDraft = computed(() => this.drafts().find((d) => d.id === this.selectedReceptionId()));

  groups = computed<ColorGroup[]>(() => {
    const map = new Map<GUID, ColorGroup>();
    for (const row of this.rows()) {
      let g = map.get(row.colorId);
      if (!g) {
        g = { colorId: row.colorId, colorName: row.colorName, total: 0, units: 0, rows: [] };
        map.set(row.colorId, g);
      }
      g.rows.push(row);
      g.total += row.totalAvailable;
      g.units += row.qty ?? 0;
    }
    const list = [...map.values()];
    for (const g of list) g.rows.sort((a, b) => a.sizeOrder - b.sizeOrder);
    list.sort((a, b) => a.colorName.localeCompare(b.colorName, 'es'));
    return list;
  });

  rowsValid = computed(
    () => this.rows().length > 0 && this.rows().every((r) => r.qty != null && r.qty >= 1),
  );

  canSave = computed(
    () =>
      this.selectedReceptionId() != null &&
      this.productActive() &&
      this.rowsValid() &&
      !this.loadingDetail(),
  );

  totalUnits = computed(() => this.rows().reduce((sum, r) => sum + (r.qty ?? 0), 0));

  /** Stock total (sucursales visibles) de todo lo seleccionado — para comparar. */
  selectionTotal = computed(() => this.rows().reduce((sum, r) => sum + r.totalAvailable, 0));

  /**
   * Aviso de transferencia: tallas sin stock en la sucursal activa pero con
   * stock en otras. Reponer en ese caso sobrecompra; lo correcto es transferir.
   */
  transferHint = computed(() => {
    const rows = this.rows().filter((r) => r.stock === 0 && r.totalAvailable > 0);
    if (rows.length === 0) return null;
    return {
      count: rows.length,
      units: rows.reduce((sum, r) => sum + r.totalAvailable, 0),
    };
  });

  pendingCosts = computed(() => this.rows().filter((r) => this.costPending(r)).length);

  saveHint = computed(() => {
    if (!this.productActive()) return 'El producto está inactivo.';
    if (this.rows().length === 0) return 'Agregá al menos una talla/color.';
    if (!this.rowsValid()) return 'Cada fila necesita una cantidad entera mayor a 0.';
    return '';
  });

  constructor() {
    this.search$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((q) => this.fetchDrafts(q)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((data) => {
        if (data) this.applyPage(data);
      });
  }

  ngOnInit(): void {
    this.loadDefaults();
  }

  ngOnDestroy(): void {
    this.createDraftModal.destroy();
  }

  // ── Paso 1: búsqueda ───────────────────────────────────────────────────
  loadDefaults(): void {
    this.loadingDrafts.set(true);
    this.draftsError.set(null);
    this.receptionService
      .getAll({ page: 1, pageSize: PAGE_SIZE, status: ReceptionStatus.Borrador })
      .subscribe({
        next: (data) => {
          this.loadingDrafts.set(false);
          this.applyPage(data);
        },
        error: () => {
          this.loadingDrafts.set(false);
          this.draftsError.set('No se pudieron cargar los borradores.');
        },
      });
  }

  /** No dispara para texto de 1 letra (sí para dígitos: el backend busca por #). */
  private fetchDrafts(query: string): Observable<PagedResult<StockReceptionListDto> | null> {
    const q = query.trim();
    const isDigits = /^\d{1,9}$/.test(q);
    if (q !== '' && !isDigits && q.length < 2) return of(null);

    this.loadingDrafts.set(true);
    this.draftsError.set(null);
    return this.receptionService
      .getAll({
        page: 1,
        pageSize: PAGE_SIZE,
        status: ReceptionStatus.Borrador,
        filter: q || undefined,
      })
      .pipe(finalize(() => this.loadingDrafts.set(false)));
  }

  private applyPage(data: PagedResult<StockReceptionListDto>): void {
    this.drafts.set(data.items.map((d) => this.toDraft(d)));
    this.totalDrafts.set(data.totalCount);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.search$.next('');
  }

  selectDraft(d: RestockDraft): void {
    if (this.loadingDetail() && this.selectedReceptionId() === d.id) return;
    this.selectedReceptionId.set(d.id);
    this.loadExistingItems(d.id);
  }

  retryDetail(): void {
    const id = this.selectedReceptionId();
    if (id) this.loadExistingItems(id);
  }

  private loadExistingItems(id: GUID): void {
    this.loadingDetail.set(true);
    this.detailError.set(null);
    this.receptionService.getReceptionDetail(id).subscribe({
      next: (detail: StockReceptionDetailDto) => {
        if (this.selectedReceptionId() !== id) return;
        this.loadingDetail.set(false);
        this.buildRows(detail.items);
        this.step.set(2);
      },
      error: () => {
        if (this.selectedReceptionId() !== id) return;
        this.loadingDetail.set(false);
        this.detailError.set('No se pudieron leer los ítems del borrador.');
      },
    });
  }

  /** `true` si consumió el atrás para volver al paso 1 (lo usa la página). */ backToDraftList(): boolean {
    if (this.step() === 1) return false;
    this.step.set(1);
    return true;
  }

  // ── Crear borrador (se crea al instante, aunque quede vacío) ───────────
  openCreateDraft(): void {
    if (!this.productActive()) return;
    this.providerService.load();
    this.createError.set(null);
    this.createDraftModal.open();
  }

  closeCreateDraft(): void {
    if (this.createSaving()) return;
    this.createDraftModal.close();
  }

  onCreateNotesInput(event: Event): void {
    this.createNotes.set((event.target as HTMLInputElement).value);
  }

  createDraft(): void {
    if (this.createSaving()) return;
    this.createForm().markAsTouched();
    if (this.createForm().invalid()) {
      this.createError.set('Seleccioná un proveedor.');
      return;
    }

    const providerId = this.createModel().id!;
    const providerName = this.createModel().name;
    const notes = this.createNotes().trim();
    this.createSaving.set(true);
    this.createError.set(null);

    const payload: CreateReceptionDto = {
      providerId,
      notes: notes || undefined,
      saveAsDraft: true,
      items: [],
    };

    this.receptionService.create(payload).subscribe({
      next: (res) => {
        this.createSaving.set(false);
        this.createDraftModal.close();

        const created: RestockDraft = {
          id: res.id,
          number: res.number ?? 0,
          providerName,
          notes: notes || undefined,
          receivedAt: new Date(),
          productVariantsCount: 0,
          totalItems: 0,
          totalCost: 0,
        };
        this.selectedReceptionId.set(res.id);
        this.detailError.set(null);
        this.buildRows([]);
        this.searchQuery.set('');
        this.drafts.update((list) => [created, ...list]);
        this.totalDrafts.update((n) => n + 1);
        this.step.set(2);
        this.createNotes.set('');
        this.createModel.set({ id: null, name: '' });
        this.search$.next('');
        this.toast.success(
          res.number != null ? `Borrador #${res.number} creado` : 'Borrador creado',
        );
      },
      error: (err: unknown) => {
        this.createSaving.set(false);
        const e = err as { error?: { detail?: string; title?: string }; message?: string };
        this.createError.set(
          e?.error?.detail ||
            e?.error?.title ||
            e?.message ||
            'No se pudo crear el borrador. Intentá de nuevo.',
        );
      },
    });
  }

  // ── Paso 2: filas y cantidades ─────────────────────────────────────────
  private buildRows(items: StockReceptionItemDetailDto[]): void {
    const existing = new Map<GUID, StockReceptionItemDetailDto>(
      items.map((i) => [i.productVariantId, i]),
    );
    const branchId = this.activeBranchId();
    this.masterQty.set(null);
    this.rows.set(
      this.variants().map((v) => {
        const ex = existing.get(v.id) ?? null;
        return {
          id: v.id,
          sku: v.sku,
          size: v.size,
          colorId: v.colorId,
          colorName: v.color,
          sizeOrder: v.sizeOrder ?? 0,
          stock: branchId ? (v.branchStocks.find((s) => s.branchId === branchId)?.stock ?? 0) : 0,
          totalAvailable: v.totalAvailable,
          existingQty: ex?.quantityReceived ?? null,
          existingCost: ex ? ex.unitCost : null,
          lastPurchaseCost: v.lastPurchaseCost ?? null,
          qty: 1,
        };
      }),
    );

    // Resumen del borrador (del detalle, no del listado que puede estar viejo).
    this.draftSummary.set({
      count: items.length,
      units: items.reduce((sum, i) => sum + i.quantityReceived, 0),
      cost: items.reduce((sum, i) => sum + i.unitCost * i.quantityReceived, 0),
    });
  }

  onQtyInput(row: RestockRow, event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const parsed = raw === '' ? NaN : Number(raw);
    const qty = Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
    this.patchRow(row.id, { qty });
  }

  onMasterQtyInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const parsed = raw === '' ? NaN : Number(raw);
    this.masterQty.set(Number.isInteger(parsed) && parsed >= 1 ? parsed : null);
  }

  applyMasterQty(): void {
    const qty = this.masterQty();
    if (qty == null) return;
    this.rows.update((rows) => rows.map((r) => ({ ...r, qty })));
  }

  removeRow(id: GUID): void {
    this.rows.update((rows) => rows.filter((r) => r.id !== id));
  }

  /**
   * Proyección de la variante: su total (sucursales visibles) más todo lo que
   * entraría si este borrador se confirma (lo que ya tiene + lo nuevo).
   */
  totalAfter(row: RestockRow): number {
    return row.totalAvailable + (row.existingQty ?? 0) + (row.qty ?? 0);
  }

  /**
   * Costo que se manda: 0 si el borrador ya tiene un costo conocido (el
   * backend lo conserva), o el último de compra para completar/nuevas líneas.
   */
  private sendCost(row: RestockRow): number {
    const preserved = this.preservedCost(row);
    return preserved != null ? 0 : (row.lastPurchaseCost ?? 0);
  }

  private preservedCost(row: RestockRow): number | null {
    return row.existingQty != null && (row.existingCost ?? 0) > 0 ? row.existingCost : null;
  }

  /** Costo final que tendrá la línea (para marcar las que quedan sin costo). */
  private finalCost(row: RestockRow): number {
    return this.preservedCost(row) ?? row.lastPurchaseCost ?? 0;
  }

  costPending(row: RestockRow): boolean {
    return this.finalCost(row) < MIN_UNIT_COST;
  }

  private patchRow(id: GUID, patch: Partial<RestockRow>): void {
    this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  onSave(): void {
    if (!this.canSave() || this.submitting()) return;
    const receptionId = this.selectedReceptionId();
    if (receptionId == null) return;
    const items: AddDraftItemDto[] = this.rows().map((r) => ({
      productVariantId: r.id,
      quantityReceived: r.qty!,
      unitCost: this.sendCost(r),
    }));
    this.save.emit({ receptionId, items });
  }

  private toDraft(d: StockReceptionListDto): RestockDraft {
    return {
      id: d.id,
      number: d.number,
      providerName: d.providerName,
      notes: d.notes,
      receivedAt: d.receivedAt,
      productVariantsCount: d.productVariantsCount,
      totalItems: d.totalItems,
      totalCost: d.totalCost,
    };
  }
}
