import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { Category } from '../../dtos/categories/category-dto';
import { CategoryService } from '@features/inventory/services/category-service';
import { CreateCategory } from '../create-category/create-category.component';

@Component({
  selector: 'app-category-select-ctrl',
  standalone: true,
  imports: [CreateCategory],
  template: `
    <div class="relative w-full" (focusout)="handleFocusOut($event)">
      <!-- INPUT + CHEVRON -->
      <div
        class="relative flex items-center w-full rounded-md border border-border bg-bg-surface text-[13px] transition-all
               focus-within:ring-2 focus-within:ring-[--focus-ring] focus-within:border-accent-ui"
      >
        <input
          type="text"
          [attr.id]="inputId() || null"
          [value]="query()"
          (focus)="isOpen.set(true)"
          (input)="onInput($event)"
          (keydown)="handleKeydown($event)"
          [placeholder]="placeholder()"
          autocomplete="off"
          class="w-full px-2.5 py-1.5 bg-transparent text-text-main placeholder:text-text-soft
                 focus:outline-none"
        />

        @if (fieldId().value()) {
          <button
            type="button"
            (mousedown)="clearSelection($event)"
            class="shrink-0 px-1 text-text-soft hover:text-feedback-error-text transition-colors"
            [attr.aria-label]="'Limpiar selección'"
          >
            <span class="material-icons text-sm">close</span>
          </button>
        }

        <button
          type="button"
          (mousedown)="toggleList($event)"
          class="shrink-0 flex items-center justify-center h-full px-1.5 text-text-soft hover:text-text-main transition-colors"
          [attr.aria-label]="'Mostrar categorías'"
        >
          <span
            class="material-icons text-lg transition-transform duration-200"
            [class.rotate-180]="isOpen()"
          >arrow_drop_down</span>
        </button>
      </div>

      <!-- DROPDOWN -->
      @if (isOpen() && (filteredOptions().length > 0 || showCreateOption())) {
        <ul class="absolute z-100 w-full mt-1.5 bg-bg-elevated border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          @for (opt of filteredOptions(); track opt.id; let i = $index) {
            <li
              (mousedown)="selectOption(opt, $event)"
              [class.!bg-bg-muted]="activeIndex() === i"
              class="flex items-center justify-between px-2.5 py-1.5 text-[13px] cursor-pointer text-text-main hover:bg-bg-muted transition-colors"
            >
              <span class="truncate">{{ opt.displayName }}</span>
              @if (opt.id === fieldId().value()) {
                <span class="material-icons text-sm text-accent-ui shrink-0 ml-2">check</span>
              }
            </li>
          }

          @if (showCreateOption()) {
            <li
              (mousedown)="openInlineCreate($event)"
              [class.!bg-feedback-success]="activeIndex() === filteredOptions().length"
              class="px-2.5 py-1.5 text-[13px] font-bold text-feedback-success-text border-t border-border cursor-pointer hover:bg-feedback-success transition-colors"
            >
              + CREAR "{{ query() }}"
            </li>
          }
        </ul>
      }

      <!-- PANEL CREAR -->
      @if (showCreate()) {
        <div class="absolute z-110 w-full mt-1.5">
          <app-create-category
            [initialName]="createQuery()"
            (created)="onCreated($event)"
            (closed)="closeInlineCreate()"
          />
        </div>
      }
    </div>
  `,
})
export class CategorySelectCtrl {
  private categoryService = inject(CategoryService);

  fieldId = input.required<FieldState<GUID>>();
  fieldName = input.required<FieldState<string>>();
  placeholder = input<string>('Categoría...');
  inputId = input<string>('');

  categoryChange = output<Category>();

  categoryOptions = computed(() =>
    this.categoryService.categories().map((c) => ({ id: c.id, displayName: c.name })),
  );

  showCreate = signal(false);
  createQuery = signal('');

  query = signal('');
  isOpen = signal(false);
  activeIndex = signal(0);

  constructor() {
    effect(() => {
      const val = this.fieldId().value();
      const opts = this.categoryOptions();
      untracked(() => {
        if (!val) {
          this.query.set('');
        } else {
          const match = opts.find((o) => o.id === val);
          if (match) this.query.set(match.displayName);
        }
      });
    });
  }

  filteredOptions = computed(() => {
    const q = this.query().toLowerCase().trim();
    return this.categoryOptions().filter((o) => o.displayName.toLowerCase().includes(q));
  });

  showCreateOption = computed(() => {
    const q = this.query().trim();
    if (!q) return false;
    return !this.categoryOptions().some((o) => o.displayName.toLowerCase() === q.toLowerCase());
  });

  handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.isOpen.set(false);
    this.fieldId().markAsTouched();
    this.fieldName().markAsTouched();
  }

  toggleList(event: MouseEvent): void {
    event.preventDefault();
    this.isOpen.update((v) => !v);
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.activeIndex.set(0);
    this.isOpen.set(true);
    if (!value) {
      this.fieldId().value.set('' as GUID);
      this.fieldName().value.set('');
    }
  }

  clearSelection(event: MouseEvent): void {
    event.preventDefault();
    this.query.set('');
    this.fieldId().value.set('' as GUID);
    this.fieldName().value.set('');
    this.activeIndex.set(0);
  }

  selectOption(opt: { id: GUID; displayName: string }, event?: MouseEvent): void {
    if (event) event.preventDefault();
    this.fieldId().value.set(opt.id);
    this.fieldName().value.set(opt.displayName);
    this.fieldId().markAsTouched();
    this.fieldName().markAsTouched();
    this.query.set(opt.displayName);
    this.isOpen.set(false);
  }

  openInlineCreate(event?: MouseEvent): void {
    if (event) event.preventDefault();
    if (!this.query().trim()) return;
    this.createQuery.set(this.query().trim());
    this.showCreate.set(true);
    this.isOpen.set(false);
  }

  closeInlineCreate(): void {
    this.showCreate.set(false);
    this.createQuery.set('');
  }

  onCreated(category: Category): void {
    this.categoryService.add(category);

    const option = this.categoryOptions().find((o) => o.id === category.id);

    this.fieldId().value.set(category.id);
    this.fieldName().value.set(option?.displayName ?? category.name);
    this.fieldId().markAsTouched();
    this.fieldName().markAsTouched();
    this.query.set(option?.displayName ?? category.name);
    this.isOpen.set(false);

    this.categoryChange.emit(category);

    this.closeInlineCreate();
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;
    const maxIndex = this.showCreateOption()
      ? this.filteredOptions().length
      : this.filteredOptions().length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((v) => (v < maxIndex ? v + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((v) => (v > 0 ? v - 1 : maxIndex));
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

  private executeSelection(): void {
    const index = this.activeIndex();
    const filtered = this.filteredOptions();
    if (index < filtered.length) {
      this.selectOption(filtered[index]);
    } else if (this.showCreateOption()) {
      this.openInlineCreate();
    }
  }
}