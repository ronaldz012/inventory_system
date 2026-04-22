import {Component, inject, signal} from '@angular/core';
import { environment } from '../../../../../environments/environment.development';
import {RouterLink} from '@angular/router';
import SideMenuOption from './side-menu-option/side-menu-option';
import {AuthService} from '../../../auth/auth-service';
import {Module} from '../../../auth/interfaces/Respones/LoginResponse';

@Component({
  selector: 'app-sidebar',
  imports: [SideMenuOption],
  templateUrl: './sidebar.html',
})
export default class Sidebar {
  // En tu componente.ts
  constructor() {
  console.log('Sidebar');
  }
  authService = inject(AuthService);

  modules = signal<Module[]>(this.authService.getModules())
//  modules = signal<Module[]>([
//   {
//     id: 1,
//     name: 'Dashboard',
//     read: true, write: true, update: true, delete: false,
//     menus: [
//       { id: 101, label: 'Resumen General', route: '/dashboard/main' },
//       { id: 102, label: 'Estadísticas', route: '/dashboard/stats' }
//     ]
//   },
//   {
//     id: 2,
//     name: 'Inventario',
//     read: true, write: false, update: false, delete: false,
//     menus: [
//       { id: 201, label: 'Productos', route: '/inventory/items' }
//     ]
//   }
// ])
}
