import { Component, computed, effect, ElementRef, inject, input, OnDestroy, output, signal, untracked, viewChild } from '@angular/core';
import { FieldState } from '@angular/forms/signals';
import { Provider } from '@features/inventory/dtos/providers/provider';
import { ProviderService } from '@features/inventory/services/provider-service';
import CreateProvider from '../create-provider/create-provider';
import { dropMaxHeightFor, dropUpFor } from '@shared/utils/dropdown-position';
import { ModalStackService, useStackedModal } from '@core/modal-stack-service';

@Component({
  selector: 'app-provider-select-ctrl',
  standalone: true,
  imports: [CreateProvider],
  template: `
    <div
      class="relative w-full"
      (focusout)="handleFocusOut($event)"
    >
      <!-- INPUT + CHEVRON -->
      <div
        class="relative flex items-center w-full rounded-lg border bg-bg-surface text-sm transition-all
               focus-within:ring-2 focus-within:ring-[--focus-ring] focus-within:border-accent-ui"
        [class.border-border]="!isTouchedInvalid()"
        [class.border-feedback-error-text]="isTouchedInvalid()"
      >
        <input
          #inputEl
          type="text"
          [value]="query()"
          (focus)="isOpen.set(true)"
          (input)="onInput($event)"
          (keydown)="handleKeydown($event)"
          [placeholder]="placeholder()"
          autocomplete="off"
          class="w-full px-3 py-1 bg-transparent text-text-main placeholder:text-text-soft
                 focus:outline-none"
        />

        @if (fieldId().value()) {
          <button
            type="button"
            (mousedown)="clearSelection($event)"
            class="shrink-0 px-1 text-text-soft hover:text-feedback-error-text transition-colors"
            [attr.aria-label]="'Limpiar selección'"
          >
            <span class="material-icons text-base">close</span>
          </button>
        }

        <button
          type="button"
          (mousedown)="toggleList($event)"
          class="shrink-0 flex items-center justify-center h-full px-2 text-text-soft hover:text-text-main transition-colors"
          [attr.aria-label]="'Mostrar proveedores'"
        >
          <span
            class="material-icons text-xl transition-transform duration-200"
            [class.rotate-180]="isOpen()"
          >arrow_drop_down</span>
        </button>
      </div>

      <!-- ERROR -->
      @if (isTouchedInvalid()) {
        <p class="text-[10px] text-feedback-error-text mt-1">Seleccioná un proveedor</p>
      }

      <!-- DROPDOWN -->
      @if (isOpen() && (filteredOptions().length > 0 || showCreateOption())) {
        <ul
          class="absolute z-100 w-full bg-bg-elevated border border-border rounded-lg shadow-lg overflow-y-auto"
          [class.mt-1.5]="!dropUp()"
          [class.mb-1.5]="dropUp()"
          [class.bottom-full]="dropUp()"
          [style.max-height.px]="dropMaxHeight()"
        >
          @for (opt of filteredOptions(); track opt.id; let i = $index) {
            <li
              (mousedown)="selectOption(opt, $event)"
              [class.!bg-bg-muted]="activeIndex() === i"
              class="flex items-center justify-between px-3 py-2 text-sm cursor-pointer text-text-main hover:bg-bg-muted transition-colors"
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
              class="px-3 py-2 text-sm font-bold text-feedback-success-text border-t border-border cursor-pointer hover:bg-feedback-success transition-colors"
            >
              + CREAR "{{ query() }}"
            </li>
          }
        </ul>
      }

      <!-- PANEL CREAR -->
      @if (showCreate()) {
        <div class="absolute z-110 w-full mt-1.5">
          <app-create-provider
            [initialName]="createQuery()"
            (created)="onCreated($event)"
            (closed)="closeInlineCreate()"
          />
        </div>
      }
    </div>
  `,
})
export default class ProviderSelectCtrl implements OnDestroy {
  private providerService = inject(ProviderService);
  private stack = inject(ModalStackService);

  fieldId = input.required<FieldState<GUID | null>>();
  fieldName = input.required<FieldState<string>>();
  placeholder = input<string>('Proveedor...');

  providerCreated = output<Provider>();

  providerOptions = computed(() =>
    this.providerService.providers().map((p) => ({ id: p.id, displayName: p.name })),
  );

  showCreate = signal(false);
  createQuery = signal('');
  private createModal = useStackedModal(this.stack, this.showCreate);

  query = signal('');
  isOpen = signal(false);
  activeIndex = signal(0);

  filteredOptions = computed(() => {
    const q = this.query().toLowerCase().trim();
    return this.providerOptions().filter((o) => o.displayName.toLowerCase().includes(q));
  });

  showCreateOption = computed(() => {
    const q = this.query().trim();
    if (!q) return false;
    return !this.providerOptions().some((o) => o.displayName.toLowerCase() === q.toLowerCase());
  });

  isTouchedInvalid = computed(
    () => this.fieldId().touched() && this.fieldId().invalid(),
  );

  handleFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement;
    if (next && (event.currentTarget as HTMLElement).contains(next)) return;
    this.isOpen.set(false);
    this.fieldId().markAsTouched();
  }

  private inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  /** Dirección y tope del desplegable (los calcula dropDirection al abrir). */
  dropUp = signal(false);
  dropMaxHeight = signal<number | null>(null);

  /** Flip: si abajo no hay lugar (filas bajas + footer sticky), abre hacia arriba. */
  private dropDirection = effect(() => {
    if (!this.isOpen()) return;
    const el = this.inputEl()?.nativeElement;
    untracked(() => {
      const up = dropUpFor(el);
      this.dropUp.set(up);
      this.dropMaxHeight.set(dropMaxHeightFor(el, up, 12, 256));
    });
  });

  toggleList(event: MouseEvent): void {
    event.preventDefault();
    this.isOpen.update((v) => !v);
    // El preventDefault bloquea el foco: lo llevamos al input a mano para que
    // el teclado abra y lo tipeado filtre (comportamiento estándar del combo).
    this.inputEl()?.nativeElement.focus();
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.activeIndex.set(0);
    this.isOpen.set(true);
    if (!value) {
      this.fieldId().value.set(null);
      this.fieldName().value.set('');
    }
  }

  clearSelection(event: MouseEvent): void {
    event.preventDefault();
    this.query.set('');
    this.fieldId().value.set(null);
    this.fieldName().value.set('');
    this.activeIndex.set(0);
    this.inputEl()?.nativeElement.focus();
  }

  selectOption(
    opt: { id: GUID; displayName: string },
    event?: MouseEvent,
  ): void {
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

  onCreated(provider: Provider): void {
    this.providerService.add(provider);

    this.fieldId().value.set(provider.id);
    this.fieldName().value.set(provider.name);
    this.fieldId().markAsTouched();
    this.fieldName().markAsTouched();
    this.query.set(provider.name);
    this.isOpen.set(false);

    this.providerCreated.emit(provider);

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