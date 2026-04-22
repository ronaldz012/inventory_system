import {Component, inject, OnInit, signal} from '@angular/core';
import ReceptionForm from './reception-form/reception-form';
import ReceptionList from './reception-list/reception-list';
import {StockReceptionListDto} from '../../dtos/Receptions/stock-reception-list-dto';
import {ReceptionService} from '../../services/reception-service';

@Component({
  selector: 'app-receptions-page',
  imports: [
    ReceptionForm,
    ReceptionList
  ],
  templateUrl: './receptions-page.html',
  styles: ``,
})
export default class ReceptionsPage implements OnInit {

  view = signal<string>('list');
  receptionService = inject(ReceptionService);
  receptionsData = signal<StockReceptionListDto[]>([]);
  ngOnInit(): void {
    this.receptionService.getReceptions({isPaged: true, page: 1, pageSize: 10,sortDirection:'desc',sortBy:'Id'}).subscribe(
      x => this.receptionsData.set(x.items))
  }
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

