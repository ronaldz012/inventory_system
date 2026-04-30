import { Component, computed, inject, input, OnInit, output, signal} from '@angular/core';
import {ProductVariantSearch} from '../../../components/product-variant-search/product-variant-search';
import {ConsoleLogger} from '@angular/compiler-cli';
import {BranchDto} from '../../../../core/dtos/branch-dto';
import {TransferItem} from '../../../interfaces/transfer-item';
import {BranchContextService} from '../../../../core/auth/branch-context-service';
import {ProductVariantBySkuDto} from '../../../dtos/products/product-variant-by-sku-dto';
import {TransferForm} from '../../../dtos/tranfers/transfer-form';
import {CreateTransferItemList} from './create-transfer-item-list/create-transfer-item-list';
import {FormsModule} from '@angular/forms';
import {BranchSelectorDestination} from '../../../../core/branch-selector-destination/branch-selector-destination';
import {TransferService} from '../../../services/transfer-service';



@Component({
  selector: 'app-create-transfer',
  imports: [
    ProductVariantSearch,
    CreateTransferItemList,
    FormsModule,
    BranchSelectorDestination
  ],
  templateUrl: './create-transfer.html',
  styles: ``,
})
export default class CreateTransfer {

  // ── Inputs del padre ────────────────────────────────────────────────────────
  branches        = input.required<BranchDto[]>();
  loadingBranches = input.required<boolean>();

  // ── Outputs al padre ─────────────────────────────────────────────────────────
  transferCreated = output<TransferForm>();
  cancelled       = output<void>();

  // ── Estado interno ────────────────────────────────────────────────────────────
  items = signal<TransferItem[]>([]);

  form = signal<TransferForm>({
    toBranchId: null,
    notes: '',
    items: [],
  });

  canSubmit = computed(() =>
    this.form().toBranchId !== null && this.items().length > 0
  );

  totalUnits = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────
  onBranchSelected(branch: BranchDto): void {
    this.form.update(f => ({ ...f, toBranchId: branch.id }));
  }

  patchNotes(notes: string): void {
    this.form.update(f => ({ ...f, notes }));
  }

  onProductFound(variant: ProductVariantBySkuDto): void {
    const existing = this.items().find(i => i.variantId === variant.id);

    if (existing) {
      if (existing.quantity >= variant.availableStockInBranch) return;
      this.items.update(items =>
        items.map(i =>
          i.variantId === variant.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      );
    } else {
      this.items.update(items => [
        ...items,
        {
          variantId:    variant.id,
          sku:          variant.sku,
          productName:  variant.productName,
          variantLabel: [variant.description, variant.size, variant.color]
            .filter(Boolean)
            .join(' · '),
          quantity:     1,
          maxQuantity:  variant.availableStockInBranch,
        },
      ]);
    }
  }

  submit(): void {
    if (!this.canSubmit()) return;

    const payload: TransferForm = {
      ...this.form(),
      items: this.items().map(i => ({
        productVariantId:  i.variantId,
        quantityRequested: i.quantity,
      })),
    };

    this.transferCreated.emit(payload);
  }

  cancel(): void {
    this.cancelled.emit();
  }

}
