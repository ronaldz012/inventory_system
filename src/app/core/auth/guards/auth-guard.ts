import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import {BranchContextService} from '../branch-context-service';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const cookieService = inject(CookieService);
  const branchContext = inject(BranchContextService);

  const token = cookieService.get('auth_token');

  if (!token) {
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url }
    });
  }

  // restaurar branches si los signals están vacíos (recarga de página)
  if (branchContext.available().length === 0) {
    const raw = localStorage.getItem('branches');
    if (raw) {
      branchContext.restoreFromStorage(JSON.parse(raw));
    }
  }

  return true;
};
