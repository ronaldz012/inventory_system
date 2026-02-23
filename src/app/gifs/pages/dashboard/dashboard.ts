import { Component } from '@angular/core';
import sidebar from '../../shared/sidebar/sidebar/sidebar';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [sidebar,RouterOutlet],
  templateUrl: './dashboard.html',
})
export default class Dashboard { }
