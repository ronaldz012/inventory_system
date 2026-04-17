import {Component, signal} from '@angular/core';
import ReceptionForm from './reception-form/reception-form';
import ReceptionList from './reception-list/reception-list';
import {StockReceptionListDto} from '../../dtos/stock-reception-list-dto';

@Component({
  selector: 'app-receptions-page',
  imports: [
    ReceptionForm,
    ReceptionList
  ],
  templateUrl: './receptions-page.html',
  styles: ``,
})
export default class ReceptionsPage {
  view = signal<string>('list');
  receptionsData = signal<StockReceptionListDto[]>([
    { id: 1, branchId: 1,notes: ' ', receivedAt: "2024-03-20T10:00:00", status: "Confirmed", totalItems: 3, totalCost: 900, types:{"pantalon":["levis"],"camisa":["nike","adidas"]}},
    { id: 2, branchId: 1,notes: ' ',receivedAt: "2024-03-21T14:30:00", status: "Confirmed", totalItems: 4, totalCost: 800, types:{"pantalon":["levis"]}},
    { id: 3, branchId: 1,notes: ' ', receivedAt: "2024-03-22T09:15:00", status: "Confirmed", totalItems: 2, totalCost: 200, types:{"pantalon":["levis"]}},
  ]);

  showForm(): void {
    this.view.set('form');
  }

  onSaved(): void {
    console.log('Recepción guardada');
    this.view.set('list');
  }

  onCancelled(): void {
    this.view.set('list');
  }
  handleViewDetails(id: number) {
    console.log('Viewing details for:', id);
    // Future implementation: this.view.set('details');
  }

  handleRollback(id: number) {
    console.log('Rolling back reception:', id);
    // Future implementation: call your API to rollback
  }
}

