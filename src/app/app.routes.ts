import { Routes } from '@angular/router';
import {authGuard} from './core/auth/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./core/Dashboard/pages/dashboard/dashboard'),
    children: [
      {
        path: 'inventory',
        children: [
          { path: 'products', loadComponent: () => import('./inventory/pages/products-page/products-page') },
          { path: 'receptions', loadComponent: () => import('./inventory/pages/receptions-page/receptions-page') },
          { path: 'transfers', loadComponent: () => import('./inventory/pages/transfers-page/transfers-page') },
        ]
      },
      {
        path: 'sales',
        children: [
          { path: 'pos', loadComponent: () => import('./sales/pages/pos-page/pos-page') },
        ]
      },
      {
        path: '**',
        redirectTo: ''
      }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./core/auth/pages/login/login'),
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
