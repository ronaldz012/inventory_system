// core/ui/paginator/paginator.ts
import { Component, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-paginator',
  standalone: true,
  template: `
    <div
      class="flex flex-wrap items-center justify-between gap-2 px-1 py-2 bg-bg-surface text-text-main"
    >
      <!-- Selector de tamaño de página -->
      <div class="flex items-center gap-2 text-xs sm:text-sm text-text-muted">
        <span class="hidden sm:inline">Mostrar</span>
        <select
          class="border border-border rounded-lg px-2 py-1 text-sm bg-bg-muted text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
          (change)="onPageSizeChange($event)"
        >
          @for (size of pageSizeOptions; track size) {
            <option
              class="bg-bg-surface text-text-main"
              [value]="size"
              [selected]="size === pageSize()"
            >
              {{ size }}
            </option>
          }
        </select>
        <span class="hidden sm:inline"
          >por página · <strong class="text-text-main">{{ totalItems() }}</strong> total</span
        >
        <span class="sm:hidden"
          ><strong class="text-text-main">{{ totalItems() }}</strong> total</span
        >
      </div>

      <!-- Navegación de páginas -->
      <div class="flex flex-wrap items-center justify-end gap-1">
        <!-- Primera página -->
        <button
          class="btn-icon border border-border bg-bg-surface hover:bg-bg-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed! transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring hidden sm:inline-flex"
          [disabled]="page() <= 1"
          (click)="goTo(1)"
          title="Primera página"
        >
          <span class="material-icons text-sm">first_page</span>
        </button>

        <!-- Página anterior -->
        <button
          class="btn-icon border border-border bg-bg-surface hover:bg-bg-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed! transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
          [disabled]="page() <= 1"
          (click)="goTo(page() - 1)"
          title="Anterior"
        >
          <span class="material-icons text-sm">chevron_left</span>
        </button>

        <!-- Números de página -->
        @for (p of visiblePages(); track p) {
          @if (p === -1) {
            <span class="px-2 text-text-soft flex items-center justify-center font-medium">…</span>
          } @else {
            <button
              class="w-8 h-8 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
              [class]="
                p === page()
                  ? 'bg-btn-primary-bg text-btn-primary-text font-semibold'
                  : 'text-text-muted bg-bg-surface hover:bg-bg-muted hover:text-text-main border border-border'
              "
              (click)="goTo(p)"
            >
              {{ p }}
            </button>
          }
        }

        <!-- Siguiente página -->
        <button
          class="btn-icon border border-border bg-bg-surface hover:bg-bg-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed! transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
          [disabled]="page() >= totalPages()"
          (click)="goTo(page() + 1)"
          title="Siguiente"
        >
          <span class="material-icons text-sm">chevron_right</span>
        </button>

        <!-- Última página -->
        <button
          class="btn-icon border border-border bg-bg-surface hover:bg-bg-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed! transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring hidden sm:inline-flex"
          [disabled]="page() >= totalPages()"
          (click)="goTo(totalPages())"
          title="Última página"
        >
          <span class="material-icons text-sm">last_page</span>
        </button>
      </div>
    </div>
  `,
})
export class Paginator {
  page = input.required<number>();
  pageSize = input.required<number>();
  totalItems = input.required<number>();

  pageChange = output<number>();
  pageSizeChange = output<number>();

  readonly pageSizeOptions = [10, 20, 50, 100];

  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++)
      pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  goTo(p: number) {
    if (p >= 1 && p <= this.totalPages()) this.pageChange.emit(p);
  }

  onPageSizeChange(e: Event) {
    const size = Number((e.target as HTMLSelectElement).value);
    this.pageSizeChange.emit(size);
    this.pageChange.emit(1); // reset a página 1
  }
}
