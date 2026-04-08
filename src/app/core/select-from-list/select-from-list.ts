import {Component, computed, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-select-from-list',
  imports: [
    FormsModule
  ],
  template: `
    <div class="relative w-full">
      <input
        type="text"
        [ngModel]="query()"
        (focus)="isOpen.set(true)"
        (blur)="handleBlur()"
        (keydown)="handleKeydown($event)"
        [placeholder]="placeholder()"
        (ngModelChange)="onQueryChange($event)"
        class="w-full px-2 py-1.5 border border-transparent rounded text-[11px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 group-hover:border-gray-200"
      />

      @if (isOpen() && (filteredOptions().length > 0 || showCreateOption())) {
        <ul class="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          @for (opt of filteredOptions(); track opt.id; let i = $index) {
            <li
              (mousedown)="selectOption(opt)"
              [class.bg-blue-50]="activeIndex() === i"
              class="px-3 py-2 text-[11px] cursor-pointer hover:bg-blue-50 text-gray-700"
            >
              {{ opt.name }}
            </li>
          }
          @if (showCreateOption()) {
            <li
              (mousedown)="emitCreate()"
              [class.bg-green-50]="activeIndex() === filteredOptions().length"
              class="px-3 py-2 text-[11px] font-bold text-green-600 border-t border-gray-100 cursor-pointer hover:bg-green-50"
            >
              + CREAR NUEVO
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: ``,
})
export class selectFromList {
  options = input.required<{id: number, name: string}[]>();
  placeholder = input<string>('');

  selected = output<{id: number, name: string}>();
  createNew = output<string>();

  query = signal('');
  isOpen = signal(false);
  activeIndex = signal(0);

  filteredOptions = computed(() => {
    const q = this.query().toLowerCase();
    return this.options().filter(o => o.name.toLowerCase().includes(q));
  });

  showCreateOption = computed(() => this.query().length > 0);

  selectOption(opt: any) {
    this.query.set(opt.name);
    this.selected.emit(opt);
    this.isOpen.set(false);
  }

  emitCreate() {
    this.createNew.emit(this.query());
    this.isOpen.set(false);
  }

  handleBlur() {
    // Timeout para permitir que el mousedown del item se ejecute antes de cerrar
    setTimeout(() => this.isOpen.set(false), 200);
  }
  onQueryChange(newValue: string) {
    this.query.set(newValue);
    const match = this.options().find(o => o.name.toLowerCase() === newValue.toLowerCase());
    if (match) {
      this.selected.emit(match);
    } else {
      this.selected.emit({ id: null as any, name: newValue });
    }
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      this.activeIndex.update(v => Math.min(v + 1, this.filteredOptions().length));
    } else if (event.key === 'ArrowUp') {
      this.activeIndex.update(v => Math.max(v - 1, 0));
    } else if (event.key === 'Enter') {
      if (this.activeIndex() === this.filteredOptions().length) {
        this.emitCreate();
      } else {
        this.selectOption(this.filteredOptions()[this.activeIndex()]);
      }
    }
  }
}
