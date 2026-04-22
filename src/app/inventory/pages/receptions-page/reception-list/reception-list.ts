import {Component, input, output} from '@angular/core';
import {CurrencyPipe, DatePipe, KeyValuePipe} from '@angular/common';
import {StockReceptionListDto} from '../../../dtos/Receptions/stock-reception-list-dto';

@Component({
  selector: 'app-reception-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    KeyValuePipe
  ],
  templateUrl: './reception-list.html',
  styles: ``,
})
export default class ReceptionList {
  // Use signals for inputs (Angular 17.1+)
  receptions = input<StockReceptionListDto[]>([]);
  // Actions
  viewDetails = output<number>();
  rollback = output<number>();

  onView(id: number) {
    this.viewDetails.emit(id);
  }

  onRollback(id: number) {
    if (confirm('¿Estás seguro de que deseas revertir esta recepción? Esta acción afectará el stock.')) {
      this.rollback.emit(id);
    }
  }
}
