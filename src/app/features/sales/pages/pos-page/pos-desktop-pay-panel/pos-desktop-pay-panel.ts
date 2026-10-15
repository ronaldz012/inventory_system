import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { PaymentMethod } from '@features/sales/models/payment-method';
import { Field, FieldState, FieldTree, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-pos-desktop-pay-panel',
  standalone: true,
  imports: [CommonModule, FormField, MoneyPipe],
  templateUrl: './pos-desktop-pay-panel.html',
})
export class PosDesktopPayPanel {
  total = input.required<number>();
  itemCount = input.required<number>();
  currentMethod = input.required<FieldState<PaymentMethod | null>>();
  transactionCode = input.required<FieldState<string | null>>();
  submitted = output<void>();
  protected readonly PaymentMethodEnum = PaymentMethod;

  onMethodChange(method: PaymentMethod) {
    this.currentMethod().value.set(method);
  }
}
