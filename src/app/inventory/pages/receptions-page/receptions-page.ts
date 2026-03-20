import {Component, signal} from '@angular/core';
import ReceptionForm from './reception-form/reception-form';

@Component({
  selector: 'app-receptions-page',
  imports: [
    ReceptionForm
  ],
  templateUrl: './receptions-page.html',
  styles: ``,
})
export default class ReceptionsPage {
  view = signal<string>('list');


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
}

