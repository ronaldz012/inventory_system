import { Component } from '@angular/core';
import sidebar from '../../components/sidebar/sidebar';
import { RouterOutlet } from '@angular/router';
import Topbar from '../../components/topbar/topbar';

@Component({
  selector: 'app-dashboard',
  imports: [sidebar, RouterOutlet, Topbar],
  templateUrl: './dashboard.html',
})
export default class Dashboard { }
