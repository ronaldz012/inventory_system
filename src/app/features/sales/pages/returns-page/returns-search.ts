import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SaleService } from '@features/sales/services/sale-service';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { Paginator } from '@shared/components/app-paginator/app-paginator';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { SkuInput } from '@shared/components/sku-input/sku-input';
import { QrScannerModal, isBarcodeApiAvailable } from '@features/sales/components/qr-scanner-modal/qr-scanner-modal';
import { SaleSkuSearchDto } from '@features/sales/dtos/returns-dto';
import ReturnRefund from './return-refund';
import { closeModal, getModalId, openModal } from '@shared/utils/modal-query';

@Component({
  selector: 'app-returns-search',
  imports: [MoneyPipe, RouterLink, SkeletonList, Paginator, SmartDatePipe, SkuInput, QrScannerModal, ReturnRefund],
  styles: `
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-up { animation: fade-up 240ms ease both; }
    .row-enter { animation: fade-up 200ms ease both; }
  `,
  template: `
    <div class="flex flex-col gap-4 w-full fade-up">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <a routerLink="/sales/pos" class="btn-icon">
          <span class="material-icons text-base">arrow_back</span>
        </a>
        <h1 class="text-lg font-black text-text-main">Reembolsos</h1>
      </div>

      <!-- Buscador -->
      <div class="bg-bg-surface rounded-xl border border-border-strong px-6 py-5">
        <label class="field-label block mb-2">SKU del producto</label>
        <div class="flex items-center gap-2">
          <app-sku-input class="flex-1" [initialValue]="skuValue()" placeholder="Escaneá o pegá el SKU..." (skuSubmit)="onSkuSubmit($event)" />
          @if (scannerAvailable()) {
            <button type="button" class="flex items-center justify-center bg-accent-ui text-white p-2.5 rounded-xl shadow-xs hover:bg-accent-ui/90 active:scale-95 transition-all shrink-0" (click)="openScanner(scanner)" title="Escanear Código">
              <span class="material-icons text-[18px]">qr_code_scanner</span>
            </button>
          }
        </div>
        <p class="mt-2 text-[11px] text-text-soft">
          Se listan las ventas de los últimos 7 días que contengan ese SKU en sus ítems.
        </p>
      </div>

      <!-- Card producto buscado -->
      @if (searched() && searchedDisplayName()) {
        <div class="flex flex-col gap-1 rounded-xl border border-border-strong bg-bg-surface px-6 py-4 shadow-xs">
          <span class="font-mono text-xs font-bold tracking-wide text-accent-ui">{{ searchedSku() }}</span>
          <p class="text-[15px] font-bold leading-snug text-text-main break-words">
            {{ searchedDisplayName() }}
          </p>
          <span class="text-xs text-text-soft">{{ totalResults() }} venta(s) encontrada(s) en los últimos 7 días</span>
        </div>
      }

      @if (loading()) {
        <app-skeleton-list [rows]="4" [columns]="4" />
      } @else if (searched() && results().length === 0) {
        <div
          class="flex flex-col items-center justify-center gap-3 py-20 bg-bg-surface border border-dashed border-border rounded-2xl text-text-soft"
        >
          <div class="w-16 h-16 rounded-full bg-bg-muted flex items-center justify-center text-text-soft/40">
            <span class="material-icons text-[36px]">receipt</span>
          </div>
          <div class="text-center px-6">
            <p class="font-bold text-text-main text-sm">Sin ventas</p>
            <p class="text-xs max-w-xs mt-1">No se encontraron ventas con ese SKU en los últimos 7 días.</p>
          </div>
        </div>
      } @else if (results().length > 0) {
        <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div
            class="hidden lg:grid lg:grid-cols-[11rem_9rem_6rem_7rem_1fr_8rem_7rem] px-4 py-3 bg-bg-muted border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-soft"
          >
            <span>Fecha</span>
            <span>Cant. × Precio</span>
            <span class="text-center">Art. dif.</span>
            <span class="text-center">Total unid.</span>
            <span>Vendedor</span>
            <span class="text-right">Monto total</span>
            <span></span>
          </div>
          <ul class="flex flex-col divide-y divide-border">
            @for (sale of results(); track sale.id) {
              <li class="row-enter bg-bg-surface relative overflow-hidden border-b border-border transition-all duration-200 hover:shadow-md">
                <div class="absolute bottom-0 left-0 top-0 w-[4px] bg-accent-ui opacity-0 transition-opacity duration-150 group-hover:opacity-100 lg:block hidden"></div>

                <!-- MOBILE: una sola fila por venta -->
                <div class="flex items-center gap-4 px-4 py-3.5 lg:hidden">
                  <div class="flex flex-col min-w-0 flex-1">
                    <p class="truncate font-inter text-sm font-bold leading-tight text-text-main">
                      {{ sale.createdAt | smartDate }}
                    </p>
                    <p class="mt-1 font-inter text-xs text-text-muted flex flex-wrap items-center gap-1.5">
                      <span class="font-bold text-accent-ui bg-accent-ui/10 px-1.5 py-0.5 rounded text-[11px]">×{{ sale.matchedItem.quantity }} · {{ sale.matchedItem.unitPrice | money: 'symbol' }}</span>
                      <span class="font-bold text-accent-ui">{{ sale.totalAmount | money: 'symbol' }}</span>
                      <span class="font-medium text-text-soft bg-bg-muted px-1.5 py-0.5 rounded text-[11px]">{{ sale.totalItems }} art. dif.</span>
                      <span class="font-medium text-text-soft bg-bg-muted px-1.5 py-0.5 rounded text-[11px]">{{ sale.totalUnitsSold }} unid.</span>
                      <span class="truncate">· {{ sale.soldByName }}</span>
                    </p>
                  </div>
                  <div class="shrink-0">
                    <button type="button" (click)="openRefund(sale)" class="btn-link">
                      <span class="btn-link-text">Ver más</span>
                      <span class="material-icons text-base">chevron_right</span>
                    </button>
                  </div>
                </div>

                <!-- DESKTOP: una sola fila por venta -->
                <div class="group hidden lg:grid lg:grid-cols-[11rem_9rem_6rem_7rem_1fr_8rem_7rem] items-center px-4 py-3 transition-colors duration-150 hover:bg-bg-muted">
                  <span class="text-[13px] font-medium text-text-main">{{ sale.createdAt | smartDate }}</span>
                  <span class="text-[11px] font-bold text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md w-fit">×{{ sale.matchedItem.quantity }} · {{ sale.matchedItem.unitPrice | money: 'symbol' }}</span>
                  <span class="text-center text-xs font-bold font-mono text-accent-ui bg-accent-ui/10 px-2 py-0.5 rounded-md w-fit mx-auto">{{ sale.totalItems }}</span>
                  <span class="text-center text-xs font-medium text-text-muted bg-bg-muted px-2 py-0.5 rounded-md w-fit mx-auto">{{ sale.totalUnitsSold }}</span>
                  <span class="text-xs text-text-muted truncate pr-2">{{ sale.soldByName }}</span>
                  <span class="text-right text-[13px] font-mono font-bold text-text-main">{{ sale.totalAmount | money: 'symbol' }}</span>
                  <div class="flex justify-end">
                    <button type="button" (click)="openRefund(sale)" class="btn-link">
                      <span class="btn-link-text">Ver más</span>
                      <span class="material-icons text-base">chevron_right</span>
                    </button>
                  </div>
                </div>
              </li>
            }
          </ul>
        </div>

        @if (!loading() && totalResults() > 0) {
          <app-paginator
            [page]="query().page!"
            [pageSize]="query().pageSize!"
            [totalItems]="totalResults()"
            (pageChange)="onPage($event)"
            (pageSizeChange)="onPageSize($event)"
          />
        }
      }
    </div>
    <app-qr-scanner-modal #scanner (scanned)="onSkuSubmit($event)" />

    <!-- Procesar devolución: bottom-sheet en mobile, side-panel en desktop -->
    @if (refundSaleId(); as rid) {
      <div class="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-overlay backdrop-blur-[1px]" (click)="closeRefund()"></div>
        <div class="relative z-10 w-full md:w-[600px] md:max-w-[90%] h-[92vh] md:h-screen bg-bg-surface rounded-t-2xl md:rounded-none md:border-l md:border-border md:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-fade-in">
          <app-return-refund class="flex-1 min-h-0 flex flex-col" [saleId]="rid" (closed)="closeRefund()" (refunded)="onRefunded()" />
        </div>
      </div>
    }
  `,
})
export default class ReturnsSearch implements OnInit {
  private saleService = inject(SaleService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  scannerAvailable = signal(false);
  refundSaleId = signal<GUID | null>(null);

  private readonly DAYS = 7;

  skuValue = signal('');
  searching = signal(false);
  searched = signal(false);
  loading = signal(false);
  results = signal<SaleSkuSearchDto[]>([]);
  totalResults = signal(0);
  searchedSku = signal('');
  searchedDisplayName = signal('');
  query = signal<{ sku?: string; days?: number; page?: number; pageSize?: number }>({
    page: 1,
    pageSize: 10,
  });

  async ngOnInit(): Promise<void> {
    this.scannerAvailable.set(await isBarcodeApiAvailable());
  }

  openScanner(scanner: QrScannerModal): void {
    scanner.open();
  }

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const modal = params.get('modal');
      const rid = getModalId(modal, 'return');
      this.refundSaleId.set(rid);
    });
    this.route.queryParamMap.subscribe((params) => {
      const sku = params.get('sku') ?? '';
      this.skuValue.set(sku);
      if (sku.trim()) {
        this.doSearch(sku);
      } else {
        this.results.set([]);
        this.totalResults.set(0);
        this.searched.set(false);
        this.searchedSku.set('');
        this.searchedDisplayName.set('');
      }
    });
  }

  onSkuSubmit(sku: string): void {
    if (!sku || this.searching()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sku },
      queryParamsHandling: 'merge',
    });
  }

  openRefund(sale: SaleSkuSearchDto): void {
    openModal(this.router, this.route, `return:${sale.id}`);
  }

  closeRefund(): void {
    closeModal(this.router, this.route);
  }

  onRefunded(): void {
    closeModal(this.router, this.route);
    this.doSearch(this.skuValue().trim());
  }

  onPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
    this.doSearch(this.skuValue().trim());
  }

  onPageSize(pageSize: number): void {
    this.query.update((q) => ({ ...q, pageSize, page: 1 }));
    this.doSearch(this.skuValue().trim());
  }

  private doSearch(sku: string): void {
    this.loading.set(true);
    const q = this.query();
    this.saleService
      .searchBySku({ sku, days: this.DAYS, page: q.page, pageSize: q.pageSize })
      .subscribe({
        next: (res) => {
          this.searchedSku.set(res.searchedSku);
          this.searchedDisplayName.set(res.searchedDisplayName);
          this.results.set(res.sales.items);
          this.totalResults.set(res.sales.totalCount);
          this.searched.set(true);
          this.searching.set(false);
          this.loading.set(false);
        },
        error: () => {
          this.searched.set(true);
          this.searching.set(false);
          this.loading.set(false);
        },
      });
  }
}
