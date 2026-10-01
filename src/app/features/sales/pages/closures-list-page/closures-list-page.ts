import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SmartDatePipe } from '@shared/pipes/smart-date.pipe';
import { CashRegisterService } from '@features/sales/services/cash-register-service';
import { ClosureListDto } from '@features/sales/dtos/closure-list-dto';
import { Paginator } from '@shared/components/app-paginator/app-paginator';
import SkeletonList from '@shared/ui/skeleton-list/skeleton-list';
import { BaseQueryDto } from '@features/inventory/dtos/base-query-dto';

@Component({
  selector: 'app-closures-list-page',
  standalone: true,
  imports: [DatePipe, CurrencyPipe, RouterLink, Paginator, SkeletonList, SmartDatePipe],
  template: `
    <div class="flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-lg font-black text-text-main">Cierres de Caja</h1>
      </div>

      @if (loading()) {
        <app-skeleton-list [rows]="4" [columns]="3" />
      } @else if (error()) {
        <div class="flex flex-col items-center gap-3 p-8 rounded border border-border bg-bg-surface shadow-sm">
          <span class="material-icons text-3xl text-feedback-error-text">error_outline</span>
          <p class="text-sm text-text-main">{{ error() }}</p>
          <button class="btn btn-primary btn-sm" (click)="load()">Reintentar</button>
        </div>
      } @else if (closures().length === 0) {
        <div
          class="flex flex-col items-center justify-center gap-3 py-20 bg-bg-surface border border-dashed border-border rounded-2xl text-text-soft"
        >
          <div
            class="w-16 h-16 rounded-full bg-bg-muted flex items-center justify-center text-text-soft/40"
          >
            <span class="material-icons text-[36px]">payments</span>
          </div>
          <div class="text-center px-6">
            <p class="font-bold text-text-main text-sm">Sin cierres</p>
            <p class="text-xs max-w-xs mt-1">No se encontraron cierres de caja registrados.</p>
          </div>
        </div>
      } @else {
        <div class="bg-bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div
            class="hidden lg:grid lg:grid-cols-8 px-4 py-3 bg-bg-muted border-b border-border table-header"
          >
            <span class="col-span-2">Apertura</span>
            <span class="text-right">Ventas</span>
            <span class="text-right">Efectivo</span>
            <span class="text-right">Gastos</span>
            <span class="text-right">Esperado</span>
            <span class="text-right">Contado</span>
            <span></span>
          </div>

          <ul class="flex flex-col divide-y divide-border">
            @for (c of closures(); track c.id) {
              <li
                class="bg-bg-surface relative overflow-hidden border-b border-border transition-all duration-200 hover:shadow-md"
              >
                <!-- MOBILE -->
                <div class="flex items-center gap-4 px-4 py-3.5 lg:hidden">
                  <div class="flex flex-col min-w-0 flex-1">
                    <p class="truncate font-inter text-sm font-bold leading-tight text-text-main">
                      {{ c.openedAt | smartDate }}
                    </p>
                    <p class="font-inter text-xs text-text-muted mt-0.5">
                      {{ c.openedByName }}
                      @if (c.closedAt) {
                        · {{ c.closedAt | date: 'HH:mm' }}
                      }
                    </p>
                    <p class="text-xs text-text-muted mt-1">
                      Ventas:
                      <span class="font-medium text-text-main">{{
                        c.totalSales | currency: 'BOB' : 'symbol' : '1.2-2'
                      }}</span>
                      · Gastos: {{ c.totalExpenses | currency: 'BOB' : 'symbol' : '1.2-2' }}
                    </p>
                    <p class="text-xs mt-0.5">
                      <span
                        [class.text-feedback-success-text]="c.difference === 0"
                        [class.text-feedback-error-text]="c.difference !== 0"
                        class="font-bold"
                      >
                        @if (c.difference === 0) {
                          Cuadra
                        } @else {
                          Dif: {{ c.difference | currency: 'BOB' : 'symbol' : '1.2-2' }}
                        }
                      </span>
                    </p>
                  </div>
                  <div class="shrink-0">
                    <a [routerLink]="['/sales', 'closures', c.id]" class="btn-link">
                      <span class="btn-link-text">Ver más</span>
                      <span class="material-icons text-base">chevron_right</span>
                    </a>
                  </div>
                </div>

                <!-- DESKTOP -->
                <div
                  class="hidden lg:grid lg:grid-cols-8 items-center px-4 py-3 transition-colors duration-150 hover:bg-bg-muted"
                >
                  <div class="col-span-2">
                    <p class="text-[13px] font-medium text-text-main">
                      {{ c.openedAt | smartDate }}
                    </p>
                    <p class="text-[11px] text-text-soft">
                      {{ c.openedByName }}
                      @if (c.closedByName) {
                        → {{ c.closedByName }}
                      }
                    </p>
                  </div>
                  <span class="text-right text-[13px] font-mono font-bold text-text-main">{{
                    c.totalSales | currency: 'BOB' : 'symbol' : '1.2-2'
                  }}</span>
                  <span class="text-right text-[13px] font-mono text-text-main">{{
                    c.cashSales | currency: 'BOB' : 'symbol' : '1.2-2'
                  }}</span>
                  <span class="text-right text-[13px] font-mono text-feedback-error-text">{{
                    c.totalExpenses | currency: 'BOB' : 'symbol' : '1.2-2'
                  }}</span>
                  <span class="text-right text-[13px] font-mono text-text-main">{{
                    c.systemSalesAmount | currency: 'BOB' : 'symbol' : '1.2-2'
                  }}</span>
                  <span class="text-right text-[13px] font-mono text-text-main">{{
                    c.realCountedAmount | currency: 'BOB' : 'symbol' : '1.2-2'
                  }}</span>
                  <div class="flex justify-end items-center gap-2">
                    <span
                      class="text-[13px] font-mono font-bold px-2 py-0.5 rounded-md"
                      [class.bg-feedback-success-bg]="c.difference === 0"
                      [class.text-feedback-success-text]="c.difference === 0"
                      [class.bg-feedback-error-bg]="c.difference !== 0"
                      [class.text-feedback-error-text]="c.difference !== 0"
                    >
                      @if (c.difference === 0) {
                        0
                      } @else {
                        {{ c.difference | currency: 'BOB' : 'symbol' : '1.2-2' }}
                      }
                    </span>
                    <a [routerLink]="['/sales', 'closures', c.id]" class="btn-link">
                      <span class="btn-link-text">Ver más</span>
                      <span class="material-icons text-base">chevron_right</span>
                    </a>
                  </div>
                </div>
              </li>
            }
          </ul>
        </div>
      }

      @if (!loading() && totalItems() > 0) {
        <app-paginator
          [page]="query().page"
          [pageSize]="query().pageSize"
          [totalItems]="totalItems()"
          (pageChange)="onPage($event)"
          (pageSizeChange)="onPageSize($event)"
        />
      }
    </div>
  `,
})
export default class ClosuresListPage implements OnInit {
  private cashRegisterService = inject(CashRegisterService);

  closures = signal<ClosureListDto[]>([]);
  totalItems = signal(0);
  loading = signal(true);
  error = signal<string | null>(null);

  query = signal<BaseQueryDto>({ page: 1, pageSize: 10 });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cashRegisterService.getClosures(this.query()).subscribe({
      next: (data) => {
        this.closures.set(data.items);
        this.totalItems.set(data.totalCount);
        this.loading.set(false);
      },
      error: (err: any) => { this.loading.set(false); const e = err as { error?: { detail?: string; title?: string }; message?: string }; this.error.set(e?.error?.detail || e?.error?.title || e?.message || 'Error al cargar cierres.'); },
    });
  }

  onPage(page: number): void {
    this.query.update((q) => ({ ...q, page }));
    this.load();
  }

  onPageSize(pageSize: number): void {
    this.query.update((q) => ({ ...q, pageSize, page: 1 }));
    this.load();
  }
}
