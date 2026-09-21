import { Component, computed, inject, input, output, OnInit, signal } from '@angular/core';
import {
  applyEach,
  form,
  FormField,
  maxLength,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { ProductDetailDto } from '../../../../dtos/products/product-detail-dto';
import { UpdateProductDto } from '../../../../dtos/products/update-product-dto';
import { Gender } from '../../../../interfaces/gender';
import { CategoryService } from '../../../../services/category-service';
import { CategorySelectCtrl } from '@features/inventory/components/category-select-ctrl/category-select-ctrl.component';

interface EditPanelRow {
  id: GUID;
  sku: string;
  size: string;
  color: string;
  currentPrice: number;
  newPrice: number | null;
}

interface EditPanelModel {
  name: string;
  description: string;
  gender: Gender | null;
  categoryId: GUID;
  categoryName: string;
  rows: EditPanelRow[];
}

const MIN_PRICE = 0.01;
const toCents = (v: number): number => Math.round(v * 100);

/**
 * Panel lateral de edición completa del producto: datos principales + precios
 * por variante en una sola llamada atómica (PUT /api/Product/{id}).
 *
 * Signal Forms puro: el modelo es la única fuente de verdad y todos los
 * campos usan [formField]. La sección de precios es un desplegable con un
 * input por variante (prefilled con el precio actual); solo viajan al backend
 * las variantes cuyo precio cambió (comparación en centavos). "Aplicar a
 * todas" es una acción puntual que rellena los inputs, cada fila sigue
 * ajustable por separado.
 */
@Component({
  selector: 'app-product-edit-panel',
  imports: [CategorySelectCtrl, FormField],
  template: `
    <div
      class="fixed inset-y-0 right-0 z-[100] flex flex-col bg-bg-surface font-inter animate-fade-in w-full md:w-[640px] md:max-w-[95%] md:border-l md:border-border md:shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.15)]"
    >
      <!-- ── HEADER ── -->
      <header class="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="pill-info">Producto</span>
          <span class="text-[13px] font-semibold text-text-main truncate">Editar producto</span>
        </div>
        <button
          type="button"
          (click)="close.emit()"
          class="btn-icon hover:bg-bg-muted hover:text-text-main"
          aria-label="Cerrar panel"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      <!-- ── MAIN ── -->
      <main class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- DATOS PRINCIPALES -->
        <section class="space-y-3" aria-label="Datos principales">
          <h3 class="section-title">Datos principales</h3>

          <div class="flex flex-col gap-1">
            <label class="field-label block" for="edit-category">Categoría</label>
            <app-category-select-ctrl
              inputId="edit-category"
              [fieldId]="editForm.categoryId()"
              [fieldName]="editForm.categoryName()" />
          </div>

          <div>
            <label class="field-label block" for="edit-name">Nombre</label>
            <input
              id="edit-name"
              type="text"
              [formField]="editForm.name"
              class="w-full px-3 py-2 text-sm text-text-main bg-bg-surface border rounded-lg
                     focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring-focus-ring"
              [class.border-feedback-error-text]="editForm.name().touched() && editForm.name().invalid()"
              [class.border-border]="!(editForm.name().touched() && editForm.name().invalid())"
              placeholder="Nombre del producto"
            />
            @if (editForm.name().touched() && editForm.name().invalid()) {
              <p class="text-[11px] text-feedback-error-text mt-1">{{ editForm.name().errors()[0].message }}</p>
            }
          </div>

          <div>
            <label class="field-label block" for="edit-description">Descripción</label>
            <textarea
              id="edit-description"
              [formField]="editForm.description"
              rows="2"
              class="w-full px-3 py-2 text-sm text-text-main bg-bg-surface border border-border rounded-lg resize-none
                     focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring-focus-ring"
              [class.border-feedback-error-text]="editForm.description().touched() && editForm.description().invalid()"
              [class.border-border]="!(editForm.description().touched() && editForm.description().invalid())"
              placeholder="Descripción del producto"
            ></textarea>
            @if (editForm.description().touched() && editForm.description().invalid()) {
              <p class="text-[11px] text-feedback-error-text mt-1">{{ editForm.description().errors()[0].message }}</p>
            }
          </div>

          <div>
            <label class="field-label block" for="edit-gender">Género</label>
            <select
              id="edit-gender"
              (change)="onGenderChange($event)"
              [value]="editModel().gender ?? ''"
              class="w-full px-3 py-2 text-sm text-text-main bg-bg-surface border border-border rounded-lg
                     focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-ring-focus-ring">
              <option value="" disabled>Seleccione</option>
              @for (g of genderOptions; track g.value) {
                <option [value]="g.value">{{ g.label }}</option>
              }
            </select>
          </div>
        </section>

        <!-- PRECIOS (desplegable) -->
        <section class="border border-border rounded-xl overflow-hidden" aria-label="Precios por variante">
          <button
            type="button"
            (click)="pricesOpen.update((v) => !v)"
            [attr.aria-expanded]="pricesOpen()"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-muted/40 transition-colors"
          >
            <span class="flex-1 min-w-0">
              <span class="block text-sm font-bold text-text-main">Precios · {{ editForm.rows.length }}</span>
              <span
                class="block text-xs mt-0.5"
                [class.text-feedback-error-text]="pricesStatus().tone === 'error'"
                [class.text-accent-ui]="pricesStatus().tone === 'accent'"
                [class.text-text-soft]="pricesStatus().tone === 'soft'"
              >{{ pricesStatus().text }}</span>
            </span>
            <span
              class="material-icons text-text-soft transition-transform duration-200"
              [class.rotate-180]="pricesOpen()"
            >expand_more</span>
          </button>

          @if (pricesOpen()) {
            <div class="border-t border-border">
              @if (editForm.rows.length > 1) {
                <div class="px-3 py-2 border-b border-border/60 bg-bg-muted/30">
                  @if (!showApplyAll()) {
                    <button
                      type="button"
                      (click)="showApplyAll.set(true)"
                      class="text-xs font-bold text-accent-ui hover:underline"
                    >Aplicar a todas</button>
                  } @else {
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        data-testid="apply-all"
                        [value]="applyAllValue() ?? ''"
                        (input)="onApplyAllInput($event)"
                        min="0.01"
                        step="0.01"
                        placeholder="Precio para todas"
                        aria-label="Precio a aplicar a todas las variantes"
                        class="flex-1 min-w-0 px-2 py-1.5 text-sm font-mono font-bold text-text-main bg-bg-surface border rounded-lg
                               focus:outline-none focus:border-accent-ui [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        [class.!border-feedback-error-text]="applyAllValue() !== null && !isApplyAllValid()"
                      />
                      <button
                        type="button"
                        (click)="applyAll()"
                        [disabled]="!isApplyAllValid()"
                        class="btn btn-primary btn-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      >Aplicar</button>
                      <button
                        type="button"
                        (click)="cancelApplyAll()"
                        class="btn btn-secondary btn-sm shrink-0"
                      >Cancelar</button>
                    </div>
                    @if (applyAllValue() !== null && !isApplyAllValid()) {
                      <p class="text-[11px] text-feedback-error-text mt-1">Ingresá un precio válido (mín. Bs 0.01).</p>
                    }
                  }
                </div>
              }

              <div
                class="hidden md:grid grid-cols-[8rem_1fr_1fr_8rem] bg-bg-muted border-b border-border"
              >
                <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft">
                  SKU
                </div>
                <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft">
                  Talla
                </div>
                <div class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft">
                  Color
                </div>
                <div
                  class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-soft text-right"
                >
                  Precio
                </div>
              </div>

              <div class="flex flex-col" data-testid="price-rows">
                @for (f of editForm.rows; track f.id().value()) {
                  <div
                    class="flex flex-col md:grid md:grid-cols-[8rem_1fr_1fr_8rem] md:items-center border-b border-border last:border-b-0 transition-colors"
                    [class.bg-accent-ui/5]="isModified(f.currentPrice().value(), f.newPrice().value())"
                  >
                    <!-- Mobile card top | Desktop: cols 1-3 via md:contents -->
                    <div class="flex items-center gap-2 px-3 py-1.5 md:p-0 md:contents">
                      <label
                        [for]="'price-' + f.id().value()"
                        class="flex-1 min-w-0 cursor-text md:contents"
                      >
                        <span
                          class="block font-mono text-[11px] font-bold text-accent-ui truncate md:px-3 md:py-2"
                          >{{ f.sku().value() }}</span
                        >
                        <span
                          class="block text-[11px] text-text-main truncate md:px-3 md:py-2"
                          >{{ f.size().value() }}</span
                        >
                        <span
                          class="block text-[11px] text-text-main truncate md:px-3 md:py-2"
                          >{{ f.color().value() }}</span
                        >
                      </label>
                    </div>

                    <!-- Mobile card bottom | Desktop: col 4 via md:contents -->
                    <div
                      class="flex items-center gap-2 px-3 py-1.5 border-t border-border/40 md:border-t-0 md:p-0 md:contents"
                    >
                      <div class="flex-1 min-w-0 md:px-2 md:py-2">
                        <input
                          [id]="'price-' + f.id().value()"
                          type="number"
                          [formField]="f.newPrice"
                          [attr.aria-label]="'Precio ' + f.sku().value() + ' ' + f.size().value() + ' ' + f.color().value()"
                          placeholder="0.00"
                          [class.!border-feedback-error-text]="f.newPrice().touched() && f.newPrice().invalid()"
                          [class.!border-accent-ui]="f.newPrice().valid() && isModified(f.currentPrice().value(), f.newPrice().value())"
                          class="w-full px-1.5 py-0.5 border border-border rounded text-[11px] font-mono font-bold text-text-main bg-bg-surface focus:outline-none focus:border-accent-ui disabled:bg-bg-muted disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none md:text-right"
                        />
                        @if (f.newPrice().touched() && f.newPrice().invalid()) {
                          @for (e of f.newPrice().errors(); track e.kind) {
                            <span
                              class="block w-full text-[9px] text-feedback-error-text font-medium leading-none mt-0.5 md:text-right"
                              >{{ e.message }}</span
                            >
                          }
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </section>
        <p class="text-xs text-text-soft">Los cambios aplican a ventas futuras. El historial conserva sus precios.</p>
      </main>

      <!-- ── FOOTER ── -->
      <footer class="border-t border-border bg-bg-surface p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0">
        <div class="w-full mx-auto flex flex-wrap items-center justify-end gap-3">
          <span class="text-[11px] text-text-muted mr-auto">{{ summary() }}</span>
          <button type="button" (click)="close.emit()" class="btn btn-secondary btn-sm">Cancelar</button>
          <button
            type="button"
            (click)="onSave()"
            [disabled]="!canSave() || submitting()"
            class="btn btn-primary btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            @if (submitting()) {
              Guardando...
            } @else {
              Guardar cambios
            }
          </button>
        </div>
      </footer>
    </div>
  `,
})
export class ProductEditPanel implements OnInit {
  private categoryService = inject(CategoryService);

  product = input.required<ProductDetailDto>();
  submitting = input<boolean>(false);

  save = output<UpdateProductDto>();
  close = output<void>();

  readonly genderOptions = [
    { label: 'Unisex', value: Gender.Unisex },
    { label: 'Hombre', value: Gender.Hombre },
    { label: 'Mujer', value: Gender.Mujer },
  ];

  // ── Modelo: única fuente de verdad ──
  editModel = signal<EditPanelModel>({
    name: '',
    description: '',
    gender: null,
    categoryId: '',
    categoryName: '',
    rows: [],
  });

  // Snapshot para dirty-tracking (normalizado en la comparación)
  private initial = signal<EditPanelModel | null>(null);

  editForm = form(this.editModel, (s) => {
    required(s.name, { message: 'El nombre es obligatorio.' });
    minLength(s.name, 3, { message: 'Mínimo 3 caracteres.' });
    maxLength(s.name, 100, { message: 'Máximo 100 caracteres.' });
    maxLength(s.description, 500, { message: 'Máximo 500 caracteres.' });
    applyEach(s.rows, (row) =>
      validate(row.newPrice, ({ value }) => {
        const v = value();
        if (v == null || v < MIN_PRICE) return { kind: 'min', message: 'Mín. Bs 0.01' };
        return null;
      }),
    );
  });

  // ── UI del desplegable de precios ──
  pricesOpen = signal(false);
  showApplyAll = signal(false);
  applyAllValue = signal<number | null>(null);

  isApplyAllValid = computed(() => {
    const v = this.applyAllValue();
    return v != null && v >= MIN_PRICE;
  });

  modifiedRows = computed(() =>
    this.editModel().rows.filter(
      (r) => r.newPrice != null && toCents(r.newPrice) !== toCents(r.currentPrice),
    ),
  );

  invalidCount = computed(
    () => this.editModel().rows.filter((r) => r.newPrice == null || r.newPrice < MIN_PRICE).length,
  );

  pricesStatus = computed(() => {
    const invalid = this.invalidCount();
    if (invalid > 0)
      return {
        tone: 'error' as const,
        text: `${invalid} ${invalid === 1 ? 'precio inválido' : 'precios inválidos'}`,
      };
    const modified = this.modifiedRows().length;
    if (modified > 0)
      return {
        tone: 'accent' as const,
        text: `${modified} ${modified === 1 ? 'precio modificado' : 'precios modificados'}`,
      };
    return { tone: 'soft' as const, text: 'Sin cambios' };
  });

  productDirty = computed(() => {
    const init = this.initial();
    if (!init) return false;
    const m = this.editModel();
    return (
      m.name.trim() !== init.name.trim() ||
      m.description.trim() !== init.description.trim() ||
      (m.gender ?? null) !== (init.gender ?? null) ||
      (m.categoryId || '') !== (init.categoryId || '')
    );
  });

  pricesDirty = computed(() => this.modifiedRows().length > 0);

  canSave = computed(() => {
    if (!this.productDirty() && !this.pricesDirty()) return false;
    return this.editForm().valid();
  });

  summary = computed(() => {
    const parts: string[] = [];
    if (this.productDirty()) parts.push('Datos');
    if (this.pricesDirty()) {
      const n = this.modifiedRows().length;
      parts.push(`${n} ${n === 1 ? 'precio' : 'precios'}`);
    }
    return parts.length > 0 ? `Se guardará: ${parts.join(' · ')}` : 'Sin cambios';
  });

  ngOnInit(): void {
    this.categoryService.load();
    const p = this.product();

    const rows: EditPanelRow[] = p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      currentPrice: v.price,
      newPrice: v.price,
    }));

    this.editModel.set({
      name: p.name ?? '',
      description: p.description ?? '',
      gender: p.gender ?? null,
      categoryId: p.categoryId ?? '',
      categoryName: p.categoryName ?? '',
      rows,
    });
    this.initial.set(structuredClone(this.editModel()));
    this.pricesOpen.set(rows.length <= 1);
  }

  isModified(current: number, next: number | null): boolean {
    return next != null && toCents(next) !== toCents(current);
  }

  onGenderChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.editModel.update((m) => ({ ...m, gender: isNaN(value) ? null : (value as Gender) }));
  }

  onApplyAllInput(event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    this.applyAllValue.set(isNaN(raw) ? null : raw);
  }

  applyAll(): void {
    const v = this.applyAllValue();
    if (v == null || v < MIN_PRICE) return;
    this.editModel.update((m) => ({
      ...m,
      rows: m.rows.map((r) => ({ ...r, newPrice: v })),
    }));
    this.cancelApplyAll();
  }

  cancelApplyAll(): void {
    this.showApplyAll.set(false);
    this.applyAllValue.set(null);
  }

  onSave(): void {
    if (!this.canSave()) return;
    const p = this.product();
    const m = this.editModel();
    const dto: UpdateProductDto = {};

    if (this.productDirty()) {
      if (m.name.trim() !== (p.name ?? '').trim()) dto.name = m.name.trim();
      if (m.description.trim() !== (p.description ?? '').trim())
        dto.description = m.description.trim();
      if ((m.gender ?? null) !== (p.gender ?? null) && m.gender != null) dto.gender = m.gender;
      if ((m.categoryId || '') !== (p.categoryId ?? '') && m.categoryId)
        dto.categoryId = m.categoryId;
    }

    dto.variantPrices = this.modifiedRows().map((r) => ({ variantId: r.id, price: r.newPrice! }));

    this.save.emit(dto);
  }
}
