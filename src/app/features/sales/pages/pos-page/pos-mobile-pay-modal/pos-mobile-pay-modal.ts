import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MoneyPipe } from '@shared/pipes/money-pipe';
import { PaymentMethod } from '@features/sales/models/payment-method';
import { Field, FieldState, FormField } from '@angular/forms/signals';

@Component({
  selector: 'app-pos-mobile-pay-modal',
  standalone: true,
  imports: [CommonModule, FormField, MoneyPipe],
  templateUrl: './pos-mobile-pay-modal.html',
})
export class PosMobilePayModal {
  total = input.required<number>();
  itemCount = input.required<number>();
  currentMethod = input.required<FieldState<PaymentMethod | null>>();
  transactionCode = input.required<FieldState<string | null>>();
  isValid = input.required<boolean>();

  closed = output<void>();
  submitted = output<void>();

  onMethodChange(method: PaymentMethod): void {
    this.currentMethod().value.set(method);
  }

  protected readonly PaymentMethodEnum = PaymentMethod;
}
