import { Component, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import CatalogSkeleton from './catalog-skeleton';
import CatalogEmpty from './catalog-empty';

@Component({
  selector: 'app-catalog-list',
  imports: [NgTemplateOutlet, CatalogSkeleton, CatalogEmpty],
  template: `
    @if (loading()) {
      <app-catalog-skeleton />
    } @else if (items().length === 0) {
      <app-catalog-empty [message]="emptyMessage()" />
    } @else {
      <div class="bg-bg-surface rounded-xl border border-border overflow-hidden">
        <!-- Header columnas — solo desktop -->
        <div
          class="hidden lg:grid px-4 py-3 bg-bg-muted border-b border-border"
          [style.grid-template-columns]="cols()"
        >
          @for (h of headers(); track h) {
            <span class="table-header">{{
              h
            }}</span>
          }
        </div>

        <!-- Items -->
        @for (item of items(); track item.id) {
          <ng-container *ngTemplateOutlet="itemTemplate(); context: { $implicit: item }" />
        }
      </div>
    }
  `,
})
export default class CatalogList {
  headers = input.required<string[]>();
  cols = input.required<string>();
  items = input.required<{ id: GUID }[]>();
  itemTemplate = input.required<import('@angular/core').TemplateRef<unknown>>();
  loading = input(false);
  emptyMessage = input('');
}
