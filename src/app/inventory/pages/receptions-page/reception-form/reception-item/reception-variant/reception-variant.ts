import {Component, computed, inject, input, OnInit, output, signal} from '@angular/core';
import {AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ProductVariantOption} from '../../../../../models/products/product-search-result';
import {VariantFormGroup} from '../../common/variant-form-group';

@Component({
  selector: 'app-reception-variant',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './reception-variant.html',
  styles: ``,
})
export default class ReceptionVariant  implements OnInit {
//DEPENDENCIES
  private fb = inject(FormBuilder);
// INPUTS
  form = input.required<VariantFormGroup>();
  availableVariants = input<ProductVariantOption[]>([]);
  index = input<number>(0);
  forceNew = input.required<boolean>();
//OUTPUTS
  remove = output<void>();
//VARIABLES
  isNewVariant = signal(false);
  variantSearch = signal('');

  ngOnInit(): void {
    // 1. Detectamos el modo actual basado en los validadores
    this.restoreModeFromValidators();

    // 2. Restauramos el label visual si hay una variante seleccionada
    const selectedId = this.productVariantIdCtrl.value;
    if (selectedId) {
      const found = this.availableVariants().find(v => v.id === selectedId);
      if (found) this.variantSearch.set(this.formatVariantLabel(found));
    }
  }
  filteredVariants = computed(() => {
    const q = this.variantSearch().toLowerCase().trim();

    // 1. Accedemos al valor del signal disponible
    const variants = this.availableVariants();

    if (!q) return variants;

    return variants.filter(
      (v) =>
        v.description.toLowerCase().includes(q) ||
        // Usamos el operador ?. de TS (como en C#) por si vienen null/undefined
        v.size?.toLowerCase().includes(q) ||
        v.color?.toLowerCase().includes(q)
    );
  });
  selectVariant(variant: ProductVariantOption): void {
    this.productVariantIdCtrl.setValue(variant.id);
    this.productVariantIdCtrl.markAsTouched();
    this.variantSearch.set(this.formatVariantLabel(variant));
  }
  selectedVariantLabel(): string {
    // 1. Obtenemos el ID del control (Typed Form)
    const id = this.productVariantIdCtrl.value;

    // 2. Si no hay ID o es null, devolvemos vacío
    if (!id) return '';

    // 3. Ejecutamos el Signal para obtener el Array y usamos find
    // Usamos this.availableVariants() con paréntesis
    const found = this.availableVariants().find((v) => v.id === id);

    return found ? this.formatVariantLabel(found) : '';
  }

  formatVariantLabel(v: ProductVariantOption): string {
    const parts = [v.description];
    if (v.size) parts.push(`Talle ${v.size}`);
    if (v.color) parts.push(v.color);
    return parts.join(' · ');
  }
  onRemove(): void {
    this.remove.emit();
  }
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

// ── Accesors del form ────────────────────────────────────────────────────
  get productVariantIdCtrl(): FormControl<number | null> {
    return this.form().controls.productVariantId;
  }

  get newVariantGroup(): FormGroup {
    return this.form().controls.newVariant;
  }

  get quantityCtrl(): FormControl {
    return this.form().controls.quantityReceived;
  }

  get unitCostCtrl(): FormControl {
    return this.form().controls.unitCost as FormControl;
  }
  private activateNewVariantMode(): void {
    // Limpiar selección existente
    this.productVariantIdCtrl.setValue(null);
    this.productVariantIdCtrl.clearValidators();
    this.productVariantIdCtrl.updateValueAndValidity();

    // Activar validadores de nueva variante
    const nv = this.newVariantGroup;
    nv.get('description')?.setValidators([Validators.required]);
    nv.get('price')?.setValidators([Validators.required, Validators.min(0.5)]);
    nv.get('description')?.updateValueAndValidity();
    nv.get('price')?.updateValueAndValidity();
  }
  private deactivateNewVariantMode(): void {
    // Requerir selección existente
    this.productVariantIdCtrl.setValidators([Validators.required]);
    this.productVariantIdCtrl.updateValueAndValidity();

    // Limpiar y quitar validadores de nueva variante
    const nv = this.newVariantGroup;
    nv.reset();
    nv.get('description')?.clearValidators();
    nv.get('price')?.clearValidators();
    nv.get('description')?.updateValueAndValidity();
    nv.get('price')?.updateValueAndValidity();
  }
//UI
  private restoreModeFromValidators(): void {
    // Si forceNew es true, siempre a New
    if (this.forceNew()) {
      this.isNewVariant.set(true);
      return;
    }

    // Verificamos si el control de descripción tiene el validador 'required'
    const descriptionCtrl = this.newVariantGroup.get('description');

    // .hasValidator es la forma moderna (Angular 12+) de checkear esto
    const isRequired = descriptionCtrl?.hasValidator(Validators.required);

    if (isRequired) {
      this.isNewVariant.set(true);
    } else {
      this.isNewVariant.set(false);
    }
  }
  showDropdown = signal(false);
  openDropdown(): void {
    this.showDropdown.set(true);
  }
  closeDropdown(): void {
    // Pequeño delay para que el click en una opción se registre primero
    setTimeout(() => this.showDropdown.set(false), 150);
  }
  hasError(ctrl: AbstractControl | null, error: string = 'required'): boolean {
    if (!ctrl) return false;
    return ctrl.hasError(error) && ctrl.touched;
  }
}
