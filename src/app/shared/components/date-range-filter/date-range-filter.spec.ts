import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DateRange, DateRangeFilter } from './date-range-filter';

@Component({
  standalone: true,
  imports: [DateRangeFilter],
  template: `<app-date-range-filter [from]="from()" [to]="to()" (rangeChange)="onRange($event)" />`,
})
class Host {
  from = signal<string | undefined>(undefined);
  to = signal<string | undefined>(undefined);
  ranges: DateRange[] = [];

  /** Igual que los listados: el padre aplica el rango (acá no hay URL). */
  onRange(range: DateRange): void {
    this.ranges.push(range);
    this.from.set(range.from);
    this.to.set(range.to);
  }
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey(): string {
  return dayKey(new Date());
}

function yesterdayKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dayKey(yesterday);
}

function tomorrowKey(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dayKey(tomorrow);
}

/** `YYYY-MM-DD` → `lun 05/10`, igual que el disparador. */
function dayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${WEEKDAYS[date.getDay()]} ${dd}/${mm}`;
}

/** Rango UTC que espera el backend para un día local. */
function expectedRange(dateStr: string): DateRange {
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Rango UTC para dos días locales inclusivos. */
function expectedSpan(from: string, to: string): DateRange {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const start = new Date(fromYear, fromMonth - 1, fromDay);
  const end = new Date(toYear, toMonth - 1, toDay);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

const flushFocus = () => new Promise((resolve) => setTimeout(resolve, 0));

async function setup(from?: string, to?: string) {
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  if (from || to) {
    fixture.componentInstance.from.set(from);
    fixture.componentInstance.to.set(to);
  }
  fixture.detectChanges();

  const root = fixture.nativeElement as HTMLElement;
  const trigger = () => root.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
  const panel = () => root.querySelector('[role="dialog"]') as HTMLElement | null;
  const input = () => panel()?.querySelector('input[type="date"]') as HTMLInputElement | null;
  // Los íconos de Material agregan su nombre al textContent ("check"), así que
  // se compara contra el primer span cuando existe.
  const labelOf = (b: HTMLButtonElement) =>
    b.querySelector('span')?.textContent?.trim() ?? b.textContent?.trim() ?? '';
  const option = (text: string) =>
    Array.from(panel()?.querySelectorAll('button') ?? []).find(
      (b) => labelOf(b) === text,
    ) as HTMLButtonElement;

  const open = () => {
    trigger().click();
    fixture.detectChanges();
  };

  const pickDate = (value: string) => {
    const field = input()!;
    field.value = value;
    field.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  // Los íconos suman su ligadura al textContent ("date_range Elegir…").
  const buttonByText = (text: string) =>
    Array.from(panel()?.querySelectorAll('button') ?? []).find((b) =>
      (b.textContent ?? '').replace(/\s+/g, ' ').includes(text),
    ) as HTMLButtonElement | undefined;

  const openRange = () => {
    buttonByText('Elegir un rango…')!.click();
    fixture.detectChanges();
  };

  const setRange = (from: string, to: string) => {
    const fromInput = panel()!.querySelector('#range-from') as HTMLInputElement;
    const toInput = panel()!.querySelector('#range-to') as HTMLInputElement;
    if (from) {
      fromInput.value = from;
      fromInput.dispatchEvent(new Event('change'));
    }
    if (to) {
      toInput.value = to;
      toInput.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
  };

  const applyRange = () => {
    buttonByText('Aplicar')!.click();
    fixture.detectChanges();
  };

  return {
    fixture,
    host: fixture.componentInstance,
    root,
    trigger,
    panel,
    input,
    option,
    open,
    pickDate,
    buttonByText,
    openRange,
    setRange,
    applyRange,
  };
}

describe('DateRangeFilter', () => {
  it('arranca sin fecha y lo dice en el disparador', async () => {
    const { trigger, panel } = await setup();

    expect(trigger().textContent).toContain('Todas las fechas');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel()).toBeNull();
  });

  it('el popover tiene presets y el campo de fecha visible', async () => {
    const { open, panel, trigger, input, option, buttonByText } = await setup();

    open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel()!.querySelectorAll('button[aria-pressed]')).toHaveLength(3);
    expect(option('Todas las fechas')).toBeDefined();
    expect(option('Hoy')).toBeDefined();
    expect(option('Ayer')).toBeDefined();
    // Sin sub-ventana: el input está a la vista apenas se abre.
    expect(input()).not.toBeNull();
    // El rango es opt-in, no reemplaza el día suelto.
    expect(buttonByText('Elegir un rango…')).toBeDefined();
  });

  it('marca la opción activa (sin fecha = "Todas las fechas")', async () => {
    const { open, option } = await setup();

    open();

    expect(option('Todas las fechas').getAttribute('aria-pressed')).toBe('true');
    expect(option('Hoy').getAttribute('aria-pressed')).toBe('false');
  });

  it('"Hoy" emite el día local completo, cierra y actualiza el disparador', async () => {
    const { fixture, host, open, option, panel, trigger } = await setup();

    open();
    option('Hoy').click();
    fixture.detectChanges();

    expect(host.ranges).toEqual([expectedRange(todayKey())]);
    expect(panel()).toBeNull();
    expect(trigger().textContent).toContain('Hoy');
  });

  it('"Ayer" emite el día anterior', async () => {
    const { fixture, host, open, option, trigger } = await setup();

    open();
    option('Ayer').click();
    fixture.detectChanges();

    expect(host.ranges).toEqual([expectedRange(yesterdayKey())]);
    expect(trigger().textContent).toContain('Ayer');
  });

  it('el campo de fecha aplica el día elegido', async () => {
    const { host, open, panel, trigger, pickDate } = await setup();

    open();
    pickDate('2026-10-05');

    expect(host.ranges).toEqual([expectedRange('2026-10-05')]);
    expect(panel()).toBeNull();
    expect(trigger().textContent).toContain(dayLabel('2026-10-05'));
  });

  it('reabre con la fecha activa cargada en el campo', async () => {
    const range = expectedRange('2026-08-14');
    const { open, input, option } = await setup(range.from, range.to);

    open();

    expect(input()!.value).toBe('2026-08-14');
    expect(option('Todas las fechas').getAttribute('aria-pressed')).toBe('false');
    expect(option('Hoy').getAttribute('aria-pressed')).toBe('false');
  });

  it('limpia con "Todas las fechas"', async () => {
    const range = expectedRange(yesterdayKey());
    const { fixture, host, open, option, trigger } = await setup(range.from, range.to);

    open();
    option('Todas las fechas').click();
    fixture.detectChanges();

    expect(host.ranges).toEqual([{ from: undefined, to: undefined }]);
    expect(trigger().textContent).toContain('Todas las fechas');
  });

  it('limpiar el campo nativo vuelve a todas las fechas', async () => {
    const range = expectedRange(todayKey());
    const { host, open, pickDate } = await setup(range.from, range.to);

    open();
    pickDate('');

    expect(host.ranges).toEqual([{ from: undefined, to: undefined }]);
  });

  it('restaura el estado desde `from`/`to` del padre', async () => {
    const range = expectedRange(todayKey());
    const { trigger, open, option, input } = await setup(range.from, range.to);

    expect(trigger().textContent).toContain('Hoy');

    open();
    expect(option('Hoy').getAttribute('aria-pressed')).toBe('true');
    expect(input()!.value).toBe(todayKey());
  });

  it('"Elegir un rango…" abre Desde y Hasta', async () => {
    const { open, openRange, panel } = await setup();

    open();
    openRange();

    expect(panel()!.querySelector('#range-from')).not.toBeNull();
    expect(panel()!.querySelector('#range-to')).not.toBeNull();
  });

  it('aplica un rango y lo muestra en el disparador', async () => {
    const { fixture, host, open, openRange, setRange, applyRange, trigger, panel } = await setup();

    open();
    openRange();
    setRange('2026-10-01', '2026-10-31');
    applyRange();

    expect(host.ranges).toEqual([expectedSpan('2026-10-01', '2026-10-31')]);
    expect(panel()).toBeNull();
    expect(trigger().textContent).toContain('01/10 – 31/10');
    fixture.detectChanges();
  });

  it('con un solo extremo aplica ese día', async () => {
    const { host, open, openRange, setRange, applyRange } = await setup();

    open();
    openRange();
    setRange('2026-10-05', '');
    applyRange();

    expect(host.ranges).toEqual([expectedRange('2026-10-05')]);
  });

  it('no aplica un rango invertido', async () => {
    const { host, open, openRange, setRange, applyRange, panel, buttonByText } = await setup();

    open();
    openRange();
    setRange('2026-10-30', '2026-10-01');

    expect(panel()!.textContent).toContain('no puede ser posterior');
    expect(buttonByText('Aplicar')!.disabled).toBe(true);

    applyRange();
    expect(host.ranges).toEqual([]);
  });

  it('no aplica un rango con fecha futura', async () => {
    const { host, open, openRange, setRange, applyRange, panel, buttonByText } = await setup();

    open();
    openRange();
    setRange(tomorrowKey(), '');

    expect(panel()!.textContent).toContain('Elegí hoy o una fecha anterior');
    expect(buttonByText('Aplicar')!.disabled).toBe(true);
    applyRange();
    expect(host.ranges).toEqual([]);
  });

  it('muestra un rango que llega desde la URL', async () => {
    const range = expectedSpan('2026-10-01', '2026-10-31');
    const { trigger, open, option } = await setup(range.from, range.to);

    expect(trigger().textContent).toContain('01/10 – 31/10');

    open();
    expect(option('Hoy').getAttribute('aria-pressed')).toBe('false');
    expect(option('Todas las fechas').getAttribute('aria-pressed')).toBe('false');
  });

  it('Escape en el rango vuelve al menú sin cerrar', async () => {
    const { fixture, open, openRange, panel, buttonByText } = await setup();

    open();
    openRange();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(panel()!.querySelector('#range-from')).toBeNull();
    expect(buttonByText('Hoy')).toBeDefined();
  });

  it('Escape cierra y devuelve el foco al disparador', async () => {
    const { fixture, open, panel, trigger } = await setup();

    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    await flushFocus();

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('un click afuera cierra el popover', async () => {
    const { fixture, open, panel } = await setup();

    open();
    document.body.click();
    fixture.detectChanges();

    expect(panel()).toBeNull();
  });

  it('no aplica una fecha futura y explica por qué', async () => {
    const { host, open, panel, input, pickDate } = await setup();

    open();
    pickDate(tomorrowKey());

    expect(host.ranges).toEqual([]);
    expect(panel()).not.toBeNull();
    expect(panel()!.textContent).toContain('Elegí hoy o una fecha anterior');
    expect(input()!.value).toBe('');
  });

  it('acepta hoy aunque sea el límite', async () => {
    const { host, open, pickDate } = await setup();

    open();
    pickDate(todayKey());

    expect(host.ranges).toEqual([expectedRange(todayKey())]);
  });
});
