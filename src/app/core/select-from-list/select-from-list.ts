import { Component, computed, effect, input, output, signal, ViewChild, ElementRef, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
               hover:border-gray-200 transition-colors"
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
              + CREAR "{{ query() }}"
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class SelectFromList {
  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  // Inputs
  options = input.required<{ id: number; name: string; description: string }[]>();
  placeholder = input<string>('');
  selectedId = input<number | null | undefined>(null);

  // Outputs
  selected = output<{ id: number; name: string; description: string } | null>();
  createNew = output<string>();
  selectionDone = output<void>();

  // internal states
  query = signal('');
  isOpen = signal(false);
  activeIndex = signal(0);

  constructor() {
    effect(() => {
      const id = this.selectedId();
      const opts = this.options();

      untracked(() => {
        if (id == null) {
          this.query.set('');
        } else {
          const match = opts.find(o => o.id === id);
          if (match) this.query.set(match.name);
        }
      });
    });
  }

  filteredOptions = computed(() => {
    const q = this.query().toLowerCase().trim();
    const list = this.options().filter(o => o.name.toLowerCase().includes(q));
    // Resetear el índice cuando cambia la lista para evitar quedar fuera de rango
    untracked(() => this.activeIndex.set(0));
    return list;
  });

  showCreateOption = computed(() => {
    const q = this.query().trim();
    if (q.length === 0) return false;
    // No mostrar "Crear" si ya existe una coincidencia exacta
    return !this.options().some(o => o.name.toLowerCase() === q.toLowerCase());
  });

  onFocus() {
    this.isOpen.set(true);
    this.activeIndex.set(0);
  }

  handleFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as HTMLElement;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.isOpen.set(false);
  }

  onQueryChange(newValue: string) {
    this.query.set(newValue);
    this.isOpen.set(true); // Aseguramos que se abra al escribir

    // Si el usuario borra todo, emitimos null para limpiar el form
    if (!newValue) {
      this.selected.emit(null);
    }
  }

  selectOption(opt: any, event?: MouseEvent) {
    if (event) event.preventDefault();
    this.query.set(opt.name);
    this.selected.emit(opt);
    this.isOpen.set(false);
    this.selectionDone.emit();
  }

  emitCreate(event?: MouseEvent) {
    if (event) event.preventDefault();
    const val = this.query().trim();
    if (val) {
      this.createNew.emit(val);
      this.isOpen.set(false);
    }
  }

  handleKeydown(event: KeyboardEvent) {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') this.isOpen.set(true);
      return;
    }

    const maxIndex = this.showCreateOption()
      ? this.filteredOptions().length
      : this.filteredOptions().length - 1;

    switch (event.key) {
      //参数
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(v => (v < maxIndex ? v + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(v => (v > 0 ? v - 1 : maxIndex));
        break;
      case 'Enter':
        event.preventDefault();
        this.executeSelection();
        break;
      case 'Escape':
      case 'Tab':
        this.isOpen.set(false);
        break;
    }
  }

  private executeSelection() {
    const index = this.activeIndex();
    const filtered = this.filteredOptions();

    if (index < filtered.length) {
      this.selectOption(filtered[index]);
    } else if (this.showCreateOption()) {
      this.emitCreate();
    }
  }
}
