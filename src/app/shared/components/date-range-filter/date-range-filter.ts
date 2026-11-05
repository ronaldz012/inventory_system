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
type DateOption = Preset | 'specific';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * Filtro de fecha en un solo control: el disparador muestra el estado
 * ("Todas las fechas", "Hoy", "Ayer" o "lun 03/11") y abre un popover con
 * los presets y un `<input type="date">` visible.
 *
 * El input es real y siempre visible dentro del popover: el calendario lo abre
 * el navegador con el click del usuario (sin `showPicker()` ni inputs ocultos),
 * que es el camino que funciona igual en desktop y mobile.
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
          </div>
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
  /** El navegador dejó elegir una fecha futura (o se tipeó): se avisa y no se aplica. */
  readonly futureBlocked = signal(false);

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

  /** Día activo, derivado de `from`/`to`. */
  readonly selected = computed<DateOption>(() => {
    this.nowTick();
    const day = this.activeDay();
    if (!day) return 'none';
    if (day === this.todayISO()) return 'today';
    if (day === this.yesterdayISO()) return 'yesterday';
    return 'specific';
  });

  readonly hasDate = computed(() => this.selected() !== 'none');

  /** Texto del disparador: es el estado, así se lee sin abrir nada. */
  readonly label = computed(() => {
    const sel = this.selected();
    if (sel === 'none') return 'Todas las fechas';
    if (sel === 'today') return 'Hoy';
    if (sel === 'yesterday') return 'Ayer';
    return this.dayLabel(this.activeDay()!);
  });

  readonly specificDate = computed(() => this.activeDay() ?? '');

  readonly maxDate = computed(() => {
    this.nowTick();
    return this.todayISO();
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

  /** Aplica el día elegido; la fecha futura se frena acá. */
  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (!value) {
      this.choose('none');
      return;
    }

    // `max` no alcanza: el tipeo manual y algunos navegadores lo saltean.
    if (value > this.todayISO()) {
      this.futureBlocked.set(true);
      input.value = this.specificDate();
      setTimeout(() => this.dateInput()?.nativeElement.focus());
      return;
    }

    this.futureBlocked.set(false);
    this.emitSingleDay(value);
    this.close();
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
    this.close();
  }

  private close(refocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.futureBlocked.set(false);
    if (refocus) setTimeout(() => this.trigger()?.nativeElement.focus());
  }

  private emitSingleDay(dateStr: string): void {
    this.rangeChange.emit({
      from: this.toUtcIsoString(dateStr, false),
      to: this.toUtcIsoString(dateStr, true),
    });
  }

  /** Día local (`YYYY-MM-DD`) del rango actual; `null` si no hay fecha. */
  private activeDay(): string | null {
    const iso = this.from() ?? this.to();
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

  private todayISO(): string {
    return this.dayKey(new Date());
  }

  private yesterdayISO(): string {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.dayKey(yesterday);
  }
}
