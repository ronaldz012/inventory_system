import { Component, input, output} from '@angular/core';
import {BranchDto} from '../dtos/branch-dto';

@Component({
  selector: 'app-branch-selector-destination',
  imports: [],
  template: `
    <div class="flex flex-col gap-1">
      <label class="text-sm text-gray-500">Sucursal destino</label>

      <select
        (change)="onSelect($event)"
        class="w-full px-3 py-2.5 text-base rounded-lg border border-gray-300
               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
               bg-white text-gray-800"
      >
        <option value="" disabled selected>Seleccionar sucursal...</option>
        @for (branch of branches(); track branch.id) {
          <option [value]="branch.id">{{ branch.name }}</option>
        }
      </select>
    </div>
  `,
  styles:``,
})
export class BranchSelectorDestination {
  branches = input.required<BranchDto[]>();
  branchSelected = output<BranchDto>();

  onSelect(event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value);
    const branch = this.branches().find(b => b.id === id);
    if (branch) this.branchSelected.emit(branch);
  }
}
