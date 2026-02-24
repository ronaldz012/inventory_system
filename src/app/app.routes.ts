import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path:'dashboard',
        children:[
                {
                    path:'trending',
                    loadComponent:() => import('./gifs/pages/trending/trending')
                },
                {
                    path:'search',
                    loadComponent:() => import('./gifs/pages/search/search')
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
