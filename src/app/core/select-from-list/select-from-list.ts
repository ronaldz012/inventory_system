import { Component, computed, effect, input, output, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category } from '../../inventory/interfaces/Dtos/category-dto';

@Component({
  selector: 'app-select-from-list',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="relative w-full" (focusout)="handleFocusOut($event)">
      <input
        #inputRef
        type="text"
        [ngModel]="query()"
        (focus)="onFocus()"
        (keydown)="handleKeydown($event)"
        [placeholder]="placeholder()"
        (ngModelChange)="onQueryChange($event)"
        class="w-full px-2 py-1.5 border border-transparent rounded text-[11px]
               focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400
               group-hover:border-gray-200"
      />

      @if (isOpen() && (filteredOptions().length > 0 || showCreateOption())) {
        <ul class="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          @for (opt of filteredOptions(); track opt.id; let i = $index) {
            <li
              (mousedown)="selectOption(opt, $event)"
              [class.bg-blue-50]="activeIndex() === i"
              class="px-3 py-2 text-[11px] cursor-pointer hover:bg-blue-50 text-gray-700"
            >
              {{ opt.name }}
            </li>
          }

          @if (showCreateOption()) {
            <li
              (mousedown)="emitCreate($event)"
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
})
export class SelectFromList {
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  options = input.required<{ id: number; name: string ; description: string}[]>();
  placeholder = input<string>('');
  selectedId = input<number | null | undefined>(null);

  selected = output<{ id: number; name: string ; description: string }  | null>();
  createNew = output<string>();
  selectionDone = output<void>(); // 🔥 Notifica al padre para mover el foco

  query = signal('');
  isOpen = signal(false);
  activeIndex = signal(0);
  ignoreNextFocus = false;

  constructor() {
    effect(() => {
      const id = this.selectedId();
      const opts = this.options();
      if (!opts?.length) return;
      if (id == null) { this.query.set(''); return; }
      const match = opts.find(o => o.id === id);
      if (match) this.query.set(match.name);
    });
  }

  filteredOptions = computed(() => {
    const q = this.query().toLowerCase();
    return this.options().filter(o => o.name.toLowerCase().includes(q));
  });

  showCreateOption = computed(() => this.query().length > 0);

  onFocus() {
    if (this.ignoreNextFocus) { this.ignoreNextFocus = false; return; }
    this.isOpen.set(true);
  }

  handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as HTMLElement;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.isOpen.set(false);
  }

  onQueryChange(newValue: string) {
    this.ignoreNextFocus = false;
    this.query.set(newValue);
    const match = this.options().find(o => o.name.toLowerCase() === newValue.toLowerCase());
    this.selected.emit(match ?? null);
  }

  selectOption(opt: Category, event?: MouseEvent) {
    if (event) event.preventDefault(); // 🔥 Evita que el input pierda el foco antes de tiempo
    this.query.set(opt.name);
    this.selected.emit(opt);
    this.isOpen.set(false);
    this.selectionDone.emit(); // 🔥 Avisamos al padre
  }

  emitCreate(event?: MouseEvent) {
    if (event) event.preventDefault();
    this.createNew.emit(this.query());
    this.isOpen.set(false);
  }

  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      this.ignoreNextFocus = true;
      this.isOpen.set(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update(v => Math.min(v + 1, this.filteredOptions().length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update(v => Math.max(v - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeIndex() === this.filteredOptions().length) {
        this.emitCreate();
      } else {
        const option = this.filteredOptions()[this.activeIndex()];
        if (option) this.selectOption(option);
      }
    }
  }
}
