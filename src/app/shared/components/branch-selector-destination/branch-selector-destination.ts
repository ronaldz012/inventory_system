import { Component, input, output } from '@angular/core';
import { BranchDto } from '../../../core/interfaces/branch.model';

@Component({
  selector: 'app-branch-selector-destination',
  imports: [],
  template: `
    <div class="flex flex-col gap-1">
      @if (!compact()) {
        <label class="text-sm text-text-muted">Sucursal destino</label>
      }

      <select
        (change)="onSelect($event)"
        [attr.aria-label]="compact() ? 'Sucursal destino' : null"
        class="w-full rounded-lg border border-border bg-bg-surface text-text-main
               focus:outline-none focus:ring-2 focus:ring-accent-ui/20 focus:border-accent-ui"
        [class.px-3]="true"
        [class.py-2.5]="!compact()"
        [class.text-base]="!compact()"
        [class.py-1.5]="compact()"
        [class.text-sm]="compact()"
      >
        <option value="" disabled selected>Seleccionar sucursal...</option>
        @for (branch of branches(); track branch.id) {
          <option [value]="branch.id">{{ branch.name }}</option>
        }
      </select>
    </div>
  `,
  styles: ``,
})
export class BranchSelectorDestination {
  branches = input.required<BranchDto[]>();
  branchSelected = output<BranchDto>();
  /** Versión de una línea sin etiqueta (ej. barra mobile). */
  compact = input(false);

  onSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const id = target.value;

    const branch = this.branches().find((b) => b.id === id);

    if (branch) {
      this.branchSelected.emit(branch);
    }
  }
}
