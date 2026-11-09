import {
  Component,
  computed,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

export interface DateRange {
  from: string | undefined;
  to: string | undefined;
}

type Preset = 'none' | 'today' | 'yesterday';
type DateOption = Preset | 'specific' | 'range';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * Filtro de fecha compacto: el disparador muestra el estado
 * ("Todas las fechas", "Hoy", "Ayer", "lun 03/11" o "01/11 – 30/11") y abre un
 * popover con los presets, un `<input type="date">` visible y, opcionalmente,
 * un rango desde–hasta.
 *
 * El día suelto sigue siendo el camino corto (Hoy/Ayer a un tap, o una fecha
 * puntual en el campo). El rango es opt-in: "Elegir un rango…" abre dos campos
 * y se aplica recién con "Aplicar", así el flujo diario no gana ni un tap.
 *
 * El input es real y siempre visible dentro del popover: el calendario lo abre
 * el navegador con el click del usuario (sin `showPicker()` ni inputs ocultos).
 *
 * No duplica estado: etiqueta, tilde y valor del input se derivan de
 * `from`/`to`, así refresh y "atrás" siempre coinciden.
 * La API pública se mantiene: `from`, `to` y `rangeChange`.
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  template: `
    <div class="relative" data-date-filter>
      <button
        #trigger
        type="button"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="'Fecha: ' + label()"
        (click)="toggle()"
        class="btn btn-secondary btn-sm gap-1.5 max-w-[13rem]"
        [class.border-accent-ui]="hasDate()"
        [class.bg-accent-ui/10]="hasDate()"
        [class.text-accent-ui]="hasDate()"
      >
        <span class="material-icons text-base leading-none" aria-hidden="true">calendar_today</span>
        <span class="truncate">{{ label() }}</span>
        <span class="material-icons text-base leading-none" aria-hidden="true">{{
          open() ? 'arrow_drop_up' : 'arrow_drop_down'
        }}</span>
      </button>

      @if (open()) {
        <div
          #panelEl
          tabindex="-1"
          role="dialog"
          aria-label="Filtrar por fecha"
          class="absolute left-0 top-[calc(100%+6px)] z-50 w-[min(17rem,calc(100vw-2rem))] rounded-xl border border-border bg-bg-surface p-1.5 shadow-lg focus:outline-none"
        >
          @if (panel() === 'menu') {
            <div class="flex flex-col">
              @for (preset of presets; track preset.value) {
                <button
                  type="button"
                  (click)="choose(preset.value)"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-main transition-colors hover:bg-bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus-ring"
                  [class.font-semibold]="isSelected(preset.value)"
                  [attr.aria-pressed]="isSelected(preset.value)"
                >
                  <span class="truncate">{{ preset.label }}</span>
                  @if (isSelected(preset.value)) {
                    <span
                      class="material-icons text-base leading-none text-accent-ui"
                      aria-hidden="true"
                      >check</span
                    >
                  }
                </button>
              }
            </div>

            <div class="mt-1 flex flex-col gap-1.5 border-t border-border pb-1 pt-2">
              <label class="field-label" for="date-filter-input">Otra fecha</label>
              <input
                #dateInput
                id="date-filter-input"
                type="date"
                [max]="maxDate()"
                [value]="specificDate()"
                (change)="onDateChange($event)"
                class="w-full px-3 py-2 text-sm bg-bg-muted border rounded-xl text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
                [class.border-accent-ui]="selected() === 'specific'"
                [class.border-border]="selected() !== 'specific'"
              />
              @if (futureBlocked()) {
                <p class="px-1 text-xs text-feedback-error-text" role="alert">
                  Elegí hoy o una fecha anterior.
                </p>
              }
              <button
                type="button"
                (click)="openRange()"
                class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-text-muted transition-colors hover:bg-bg-muted hover:text-text-main"
              >
                <span class="material-icons text-base leading-none" aria-hidden="true"
                  >date_range</span
                >
                Elegir un rango…
              </button>
            </div>
          } @else {
            <div class="flex flex-col gap-1.5 p-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="field-label">Rango de fechas</span>
                <button
                  type="button"
                  (click)="backToMenu()"
                  class="px-1 text-xs text-text-soft transition-colors hover:text-text-main hover:underline"
                >
                  Volver
                </button>
              </div>

              <label class="field-label" for="range-from">Desde</label>
              <input
                #rangeFrom
                id="range-from"
                type="date"
                [max]="maxDate()"
                [value]="draftFrom()"
                (change)="onDraftChange('from', $event)"
                class="w-full px-3 py-2 text-sm bg-bg-muted border border-border rounded-xl text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
              />

              <label class="field-label" for="range-to">Hasta</label>
              <input
                #rangeTo
                id="range-to"
                type="date"
                [max]="maxDate()"
                [value]="draftTo()"
                (change)="onDraftChange('to', $event)"
                class="w-full px-3 py-2 text-sm bg-bg-muted border border-border rounded-xl text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus-ring"
              />

              @if (rangeError(); as error) {
                <p class="px-1 text-xs text-feedback-error-text" role="alert">{{ error }}</p>
              }

              <button
                type="button"
                (click)="applyRange()"
                [disabled]="!canApplyRange()"
                class="btn btn-primary btn-sm mt-1 w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Aplicar
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DateRangeFilter {
  /** Valores actuales desde el padre (fuente de verdad). */
  from = input<string | undefined>(undefined);
  to = input<string | undefined>(undefined);

  /** Emite cuando cambia el rango */
  rangeChange = output<DateRange>();

  readonly open = signal(false);
  /** `menu`: presets + un día. `range`: formulario desde–hasta. */
  readonly panel = signal<'menu' | 'range'>('menu');
  /** El navegador dejó elegir una fecha futura (o se tipeó): se avisa y no se aplica. */
  readonly futureBlocked = signal(false);

  readonly draftFrom = signal('');
  readonly draftTo = signal('');
  readonly rangeError = signal<string | null>(null);

  /** Se incrementa al abrir para recalcular "Hoy" si la pestaña cruzó la medianoche. */
  private readonly nowTick = signal(0);

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelEl = viewChild<ElementRef<HTMLDivElement>>('panelEl');
  private readonly dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  readonly presets: { value: Preset; label: string }[] = [
    { value: 'none', label: 'Todas las fechas' },
    { value: 'today', label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
  ];

  /** Estado activo, derivado de `from`/`to`. */
  readonly selected = computed<DateOption>(() => {
    this.nowTick();
    const range = this.activeRange();
    if (!range) return 'none';
    if (range.from !== range.to) return 'range';
    if (range.from === this.todayISO()) return 'today';
    if (range.from === this.yesterdayISO()) return 'yesterday';
    return 'specific';
  });

  readonly hasDate = computed(() => this.selected() !== 'none');

  /** Texto del disparador: es el estado, así se lee sin abrir nada. */
  readonly label = computed(() => {
    const sel = this.selected();
    if (sel === 'none') return 'Todas las fechas';
    if (sel === 'today') return 'Hoy';
    if (sel === 'yesterday') return 'Ayer';

    const range = this.activeRange()!;
    if (sel === 'range') return this.rangeLabel(range.from, range.to);
    return this.dayLabel(range.from);
  });

  readonly specificDate = computed(() => this.activeRange()?.from ?? '');

  readonly maxDate = computed(() => {
    this.nowTick();
    return this.todayISO();
  });

  readonly canApplyRange = computed(() => {
    const from = this.draftFrom();
    const to = this.draftTo();
    return (!!from || !!to) && this.rangeError() === null;
  });

  isSelected(value: DateOption): boolean {
    return this.selected() === value;
  }

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.nowTick.update((n) => n + 1);
    this.futureBlocked.set(false);
    this.panel.set('menu');
    this.open.set(true);
    setTimeout(() => this.panelEl()?.nativeElement.focus());
  }

  choose(value: Preset): void {
    this.futureBlocked.set(false);

    if (value === 'none') {
      this.rangeChange.emit({ from: undefined, to: undefined });
      this.close();
      return;
    }

    this.emitSingleDay(value === 'today' ? this.todayISO() : this.yesterdayISO());
    this.close();
  }

  /** Aplica el día elegido en el campo único; la fecha futura se frena acá. */
  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!value) {
      this.choose('none');
      return;
    }

    if (this.isFuture(value)) {
      this.futureBlocked.set(true);
      input.value = this.specificDate();
      setTimeout(() => this.dateInput()?.nativeElement.focus());
      return;
    }

    this.futureBlocked.set(false);
    this.emitSingleDay(value);
    this.close();
  }

  /** Abre el formulario de rango, precargado con el estado actual. */
  openRange(): void {
    this.nowTick.update((n) => n + 1);
    const range = this.activeRange();
    this.draftFrom.set(range?.from ?? '');
    // Un día suelto deja "Hasta" vacío: se completa solo si quiere el rango.
    this.draftTo.set(range && range.to !== range.from ? range.to : '');
    this.rangeError.set(null);
    this.panel.set('range');
  }

  onDraftChange(field: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'from') this.draftFrom.set(value);
    else this.draftTo.set(value);
    this.validateDraft();
  }

  applyRange(): void {
    if (!this.canApplyRange()) return;
    const start = this.draftFrom() || this.draftTo();
    const end = this.draftTo() || this.draftFrom();
    this.rangeChange.emit({
      from: this.toUtcIsoString(start, false),
      to: this.toUtcIsoString(end, true),
    });
    this.close();
  }

  backToMenu(): void {
    this.rangeError.set(null);
    this.panel.set('menu');
    setTimeout(() => this.panelEl()?.nativeElement.focus());
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) return;
    if (this.open() && !target.closest('[data-date-filter]')) {
      this.close(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    if (this.panel() === 'range') {
      this.backToMenu();
      return;
    }
    this.close();
  }

  private close(refocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.panel.set('menu');
    this.futureBlocked.set(false);
    this.rangeError.set(null);
    if (refocus) setTimeout(() => this.trigger()?.nativeElement.focus());
  }

  private validateDraft(): void {
    const from = this.draftFrom();
    const to = this.draftTo();

    if (this.isFuture(from) || this.isFuture(to)) {
      this.rangeError.set('Elegí hoy o una fecha anterior.');
      return;
    }

    if (from && to && from > to) {
      this.rangeError.set('La fecha "desde" no puede ser posterior a "hasta".');
      return;
    }

    this.rangeError.set(null);
  }

  private isFuture(value: string): boolean {
    return !!value && value > this.todayISO();
  }

  private emitSingleDay(dateStr: string): void {
    this.rangeChange.emit({
      from: this.toUtcIsoString(dateStr, false),
      to: this.toUtcIsoString(dateStr, true),
    });
  }

  /** Días locales (`YYYY-MM-DD`) del rango actual; `null` si no hay fecha. */
  private activeRange(): { from: string; to: string } | null {
    const start = this.dayOf(this.from() ?? this.to());
    const end = this.dayOf(this.to() ?? this.from());
    if (!start || !end) return null;
    return start <= end ? { from: start, to: end } : { from: end, to: start };
  }

  private dayOf(iso: string | undefined): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return this.dayKey(date);
  }

  private toUtcIsoString(dateStr: string, endOfDay: boolean): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const local = new Date(year, month - 1, day);
    if (endOfDay) local.setHours(23, 59, 59, 999);
    return local.toISOString();
  }

  /** Fecha local `YYYY-MM-DD`. No usar toISOString(): en UTC-4 cambia de día de noche. */
  private dayKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** `YYYY-MM-DD` → `lun 03/11` (el día de la semana ayuda a ubicarse al arquear). */
  private dayLabel(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${WEEKDAYS[date.getDay()]} ${dd}/${mm}`;
  }

  /** `01/11 – 30/11`; con año solo si el rango cruza el año. */
  private rangeLabel(from: string, to: string): string {
    const [fromYear, fromMonth, fromDay] = from.split('-');
    const [toYear, toMonth, toDay] = to.split('-');
    const start = `${fromDay}/${fromMonth}`;
    const end = `${toDay}/${toMonth}`;
    if (fromYear !== toYear) return `${start}/${fromYear.slice(2)} – ${end}/${toYear.slice(2)}`;
    return `${start} – ${end}`;
  }

  private todayISO(): string {
    return this.dayKey(new Date());
  }

  private yesterdayISO(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.dayKey(yesterday);
  }
}
