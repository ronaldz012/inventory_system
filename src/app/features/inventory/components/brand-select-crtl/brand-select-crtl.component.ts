import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Brand } from '@features/inventory/dtos/brands/brand-dto';
import CreateBrand from '../create-brand/create-brand.component';
import { FieldState } from '@angular/forms/signals';
import { BrandService } from '@features/inventory/services/brand-service';
import { dropMaxHeightFor, dropUpFor } from '@shared/utils/dropdown-position';
import { ModalStackService, useStackedModal } from '@core/modal-stack-service';

@Component({
  selector: 'app-brand-select-ctrl',
  standalone: true,
  imports: [CreateBrand],
  template: `
    <div class="relative w-full" (focusout)="handleFocusOut($event)">
      <!-- INPUT + CHEVRON -->
      <div
        class="relative flex items-center w-full rounded-md border border-border bg-bg-surface text-[13px] transition-all
               focus-within:ring-2 focus-within:ring-[--focus-ring] focus-within:border-accent-ui"
      >
        <input
          #comboInput
          type="text"
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
          [attr.aria-label]="'Mostrar marcas'"
        >
          <span
            class="material-icons text-lg transition-transform duration-200"
            [class.rotate-180]="isOpen()"
          >arrow_drop_down</span>
        </button>
      </div>

      <!-- DROPDOWN -->
      @if (isOpen() && (filteredOptions().length > 0 || showCreateOption())) {
        <ul
          class="absolute z-100 w-full bg-bg-elevated border border-border rounded-md shadow-lg overflow-y-auto"
          [class.mt-1.5]="!dropUp()"
          [class.mb-1.5]="dropUp()"
          [class.bottom-full]="dropUp()"
          [style.max-height.px]="dropMaxHeight()"
        >
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
          <app-create-brand
            [initialName]="createQuery()"
            (created)="onCreated($event)"
            (closed)="closeInlineCreate()"
          />
        </div>
      }
    </div>
  `,
})
export class BrandSelectCtrl implements OnDestroy {
  private service = inject(BrandService);
  private stack = inject(ModalStackService);

  fieldId = input.required<FieldState<GUID>>();
  fieldName = input.required<FieldState<string>>();
  placeholder = input<string>('Marca...');

  brandOptions = computed(() =>
    this.service.brands().map((b) => ({ id: b.id, displayName: b.name })),
  );

  showCreate = signal(false);
  createQuery = signal('');
  private createModal = useStackedModal(this.stack, this.showCreate);

  query = signal('');
  isOpen = signal(false);
  activeIndex = signal(0);

  constructor() {
    effect(() => {
      const val = this.fieldId().value();
      const opts = this.brandOptions();
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
    return this.brandOptions().filter((o) => o.displayName.toLowerCase().includes(q));
  });

  showCreateOption = computed(() => {
    const q = this.query().trim();
    if (!q) return false;
    return !this.brandOptions().some((o) => o.displayName.toLowerCase() === q.toLowerCase());
  });

  handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.isOpen.set(false);
    this.fieldId().markAsTouched();
    this.fieldName().markAsTouched();
  }

  private comboInput = viewChild<ElementRef<HTMLInputElement>>('comboInput');

  /** Dirección y tope del desplegable (los calcula dropDirection al abrir). */
  dropUp = signal(false);
  dropMaxHeight = signal<number | null>(null);

  /** Flip: si abajo no hay lugar (filas bajas + footer sticky), abre hacia arriba. */
  private dropDirection = effect(() => {
    if (!this.isOpen()) return;
    const el = this.comboInput()?.nativeElement;
    untracked(() => {
      const up = dropUpFor(el);
      this.dropUp.set(up);
      this.dropMaxHeight.set(dropMaxHeightFor(el, up));
    });
  });

  toggleList(event: MouseEvent): void {
    event.preventDefault();
    this.isOpen.update((v) => !v);
    // El preventDefault bloquea el foco: lo llevamos al input a mano para que
    // el teclado abra y lo tipeado filtre (comportamiento estándar del combo).
    this.comboInput()?.nativeElement.focus();
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
    this.comboInput()?.nativeElement.focus();
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
    this.createModal.open();
    this.isOpen.set(false);
  }

  closeInlineCreate(): void {
    this.createModal.close();
    this.createQuery.set('');
  }

  ngOnDestroy(): void {
    this.createModal.destroy();
  }

  onCreated(brand: Brand): void {
    this.service.add(brand);

    this.fieldId().value.set(brand.id);
    this.fieldName().value.set(brand.name);
    this.fieldId().markAsTouched();
    this.fieldName().markAsTouched();
    this.query.set(brand.name);
    this.isOpen.set(false);

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