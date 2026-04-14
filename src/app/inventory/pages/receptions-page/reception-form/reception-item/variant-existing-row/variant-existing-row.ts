import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { ProductVariantOption } from '../../../../../components/product-search/product-search-result';
import { VariantFormGroup } from '../../common/variant-form-group';

@Component({
  selector: 'app-variant-existing-row',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './variant-existing-row.html',
  styles: [`
    :host {
      display: contents; /* Esto permite que los divs hijos se alineen con el grid del padre */
    }
  `]
})
export default class VariantExistingRow implements OnInit {
  // ── Dependencies ──────────────────────────────────────────────────────
  private destroyRef = inject(DestroyRef);

  // ── Inputs ────────────────────────────────────────────────────────────
  form              = input.required<VariantFormGroup>();
  availableVariants = input<ProductVariantOption[]>([]);
  usedVariantIds    = input<number[]>([]);
  index             = input<number>(0);
  canSwitchToNew    = input<boolean>(true);

  // ── Outputs ───────────────────────────────────────────────────────────
  remove      = output<void>();
  switchToNew = output<void>();

  // ── Estado UI ─────────────────────────────────────────────────────────
  variantSearch = signal('');
  showDropdown  = signal(false);

  // ── Puentes reactivos ─────────────────────────────────────────────────
  private selectedVariantId = signal<number | null>(null);
  private qtySignal         = signal(0);
  private costSignal        = signal(0);

  // ── Computados ────────────────────────────────────────────────────────
  private selectedVariant = computed<ProductVariantOption | undefined>(() =>
    this.availableVariants().find(v => v.id === this.selectedVariantId())
  );

  selectedVariantSize  = computed(() => this.selectedVariant()?.size  ?? '');
  selectedVariantColor = computed(() => this.selectedVariant()?.color ?? '');
  selectedVariantPrice = computed(() => this.selectedVariant()?.price ?? null);
  subtotal             = computed(() => this.qtySignal() * this.costSignal());

  filteredVariants = computed(() => {
    const q         = this.variantSearch().toLowerCase().trim();
    const usedIds   = this.usedVariantIds();
    const currentId = this.selectedVariantId();

    const available = this.availableVariants().filter(
      v => !usedIds.includes(v.id) || v.id === currentId
    );

    if (!q) return available;
    return available.filter(v =>
      v.description.toLowerCase().includes(q) ||
      v.size?.toLowerCase().includes(q) ||
      v.color?.toLowerCase().includes(q)
    );
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.restoreSelectedVariant();
    this.syncSubtotalSignals();
  }

  private restoreSelectedVariant(): void {
    const id = this.productVariantIdCtrl.value;
    if (!id) return;
    this.selectedVariantId.set(id);
    const found = this.availableVariants().find(v => v.id === id);
    if (found) this.variantSearch.set(this.formatDropdownLabel(found));
  }

  private syncSubtotalSignals(): void {
    const { quantityReceived, unitCost } = this.form().controls;
    this.qtySignal.set(quantityReceived.value ?? 0);
    this.costSignal.set(unitCost.value ?? 0);

    quantityReceived.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => this.qtySignal.set(val ?? 0));

    unitCost.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => this.costSignal.set(val ?? 0));
  }

  // ── Dropdown ──────────────────────────────────────────────────────────
  openDropdown():  void { this.showDropdown.set(true); }
  closeDropdown(): void { setTimeout(() => this.showDropdown.set(false), 150); }

  onSearchInput(value: string): void {
    this.variantSearch.set(value);
    const selected = this.selectedVariant();
    if (selected && value !== this.formatDropdownLabel(selected)) {
      this.productVariantIdCtrl.setValue(null);
      this.selectedVariantId.set(null);
    }
    this.openDropdown();
  }

  selectVariant(variant: ProductVariantOption): void {
    this.productVariantIdCtrl.setValue(variant.id);
    this.selectedVariantId.set(variant.id);
    this.productVariantIdCtrl.markAsTouched();
    this.variantSearch.set(this.formatVariantLabel(variant));
    this.showDropdown.set(false);
  }

  // ── Accessors ─────────────────────────────────────────────────────────
  get productVariantIdCtrl(): FormControl<number | null> {
    return this.form().controls.productVariantId;
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  formatVariantLabel(v: ProductVariantOption):  string { return v.description; }
  formatDropdownLabel(v: ProductVariantOption): string {
    const parts = [v.description];
    if (v.size)  parts.push(`Talle ${v.size}`);
    if (v.color) parts.push(v.color);
    return parts.join(' · ');
  }

  onRemove():      void { this.remove.emit(); }
  onSwitchToNew(): void { this.switchToNew.emit(); }

  hasError(ctrl: AbstractControl | null, error = 'required'): boolean {
    if (!ctrl) return false;
    return ctrl.hasError(error) && ctrl.touched;
  }
}
