import { Routes } from '@angular/router';
import {authGuard} from './core/auth/guards/auth-guard';

export const routes: Routes = [
    {
        path:'dashboard',
        // canActivate:[authGuard],
      loadComponent: () => import('./gifs/pages/dashboard/dashboard'), // ← el shell con sidebar
        children:[
                {
                    path:'trending',
                    loadComponent:() => import('./gifs/pages/trending/trending')
                },
                {
                    path:'search',
                    loadComponent:() => import('./gifs/pages/search/search')
                },
          {
            path:'**',
            redirectTo: 'trending',
          }

        ]
    },
    {
      path:'login',
      loadComponent: () => import('./core/auth/pages/login/login'),
    },
    {
        path:'**',
        redirectTo:'dashboard'
    }

];
