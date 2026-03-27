import {Component, computed, inject, input, OnInit, output, signal} from '@angular/core';
import {AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ProductVariantOption} from '../../../../../models/products/product-search-result';
import {VariantFormGroup} from '../../common/variant-form-group';
import {DecimalPipe} from '@angular/common';

@Component({
  selector: 'app-reception-variant',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
  ],
  templateUrl: './reception-variant.html',
  styles: ``,
})
export default class ReceptionVariant implements OnInit {
  // DEPENDENCIES
  private fb = inject(FormBuilder);

  // INPUTS
  form = input.required<VariantFormGroup>();
  availableVariants = input<ProductVariantOption[]>([]);
  index = input<number>(0);
  forceNew = input.required<boolean>();

  // OUTPUTS
  remove = output<void>();

  // STATE
  isNewVariant = signal(false);
  variantSearch = signal('');
  showDropdown = signal(false);

  // ── Señales computadas para la variante seleccionada ──────────────────

  /** Variante actualmente seleccionada (objeto completo). */
  private selectedVariant = computed<ProductVariantOption | undefined>(() => {
    const id = this.productVariantIdCtrl.value;
    if (!id) return undefined;
    return this.availableVariants().find(v => v.id === id);
  });

  selectedVariantSize = computed(() => this.selectedVariant()?.size ?? '');
  selectedVariantColor = computed(() => this.selectedVariant()?.color ?? '');
  selectedVariantPrice = computed(() => this.selectedVariant()?.price ?? null);

  /** Subtotal = quantityReceived × unitCost. */
  subtotal = computed(() => {
    const qty = this.form().controls.quantityReceived.value ?? 0;
    const cost = this.form().controls.unitCost.value ?? 0;
    return qty * cost;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.restoreModeFromValidators();

    const selectedId = this.productVariantIdCtrl.value;
    if (selectedId) {
      const found = this.availableVariants().find(v => v.id === selectedId);
      if (found) this.variantSearch.set(this.formatVariantLabel(found));
    }
  }

  // ── Dropdown / búsqueda ───────────────────────────────────────────────

  filteredVariants = computed(() => {
    const q = this.variantSearch().toLowerCase().trim();
    const variants = this.availableVariants();
    if (!q) return variants;
    return variants.filter(v =>
      v.description.toLowerCase().includes(q) ||
      v.size?.toLowerCase().includes(q) ||
      v.color?.toLowerCase().includes(q)
    );
  });

  openDropdown(): void { this.showDropdown.set(true); }
  closeDropdown(): void { setTimeout(() => this.showDropdown.set(false), 150); }

  selectVariant(variant: ProductVariantOption): void {
    this.productVariantIdCtrl.setValue(variant.id);
    this.productVariantIdCtrl.markAsTouched();
    this.variantSearch.set(this.formatVariantLabel(variant));
  }

  formatVariantLabel(v: ProductVariantOption): string {
    const parts = [v.description];
    if (v.size) parts.push(`Talle ${v.size}`);
    if (v.color) parts.push(v.color);
    return parts.join(' · ');
  }

  // ── Modo Ex / New ─────────────────────────────────────────────────────

  switchToNew(): void {
    this.isNewVariant.set(true);
    this.activateNewVariantMode();
  }

  switchToExisting(): void {
    if (this.forceNew()) return;
    this.isNewVariant.set(false);
    this.deactivateNewVariantMode();
    this.variantSearch.set('');
  }

  private activateNewVariantMode(): void {
    this.productVariantIdCtrl.setValue(null);
    this.productVariantIdCtrl.clearValidators();
    this.productVariantIdCtrl.updateValueAndValidity();

    const nv = this.newVariantGroup;
    nv.get('description')?.setValidators([Validators.required]);
    nv.get('price')?.setValidators([Validators.required, Validators.min(0.5)]);
    nv.get('description')?.updateValueAndValidity();
    nv.get('price')?.updateValueAndValidity();
  }

  private deactivateNewVariantMode(): void {
    this.productVariantIdCtrl.setValidators([Validators.required]);
    this.productVariantIdCtrl.updateValueAndValidity();

    const nv = this.newVariantGroup;
    nv.reset();
    nv.get('description')?.clearValidators();
    nv.get('price')?.clearValidators();
    nv.get('description')?.updateValueAndValidity();
    nv.get('price')?.updateValueAndValidity();
  }

  private restoreModeFromValidators(): void {
    if (this.forceNew()) {
      this.isNewVariant.set(true);
      return;
    }
    const descriptionCtrl = this.newVariantGroup.get('description');
    this.isNewVariant.set(descriptionCtrl?.hasValidator(Validators.required) ?? false);
  }

  // ── Accesors ──────────────────────────────────────────────────────────

  get productVariantIdCtrl(): FormControl<number | null> {
    return this.form().controls.productVariantId;
  }

  get newVariantGroup(): FormGroup {
    return this.form().controls.newVariant;
  }

  onRemove(): void { this.remove.emit(); }

  hasError(ctrl: AbstractControl | null, error: string = 'required'): boolean {
    if (!ctrl) return false;
    return ctrl.hasError(error) && ctrl.touched;
  }
}
