import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { BranchContextService } from '@core/services/branch-context-service';
import { SessionFeatureDto } from '@features/auth/models/LoginResponse';

export type FeaturePermission = 'read' | 'create' | 'update' | 'delete' | 'margin';

export interface FeatureRouteData {
  module: string;
  feature: string;
  permission?: FeaturePermission;
}

export const featureGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const branchContext = inject(BranchContextService);

  const {
    module: moduleRoute,
    feature: featureRoute,
    permission = 'read',
  } = route.data as FeatureRouteData;

  // Sin datos de ruta configurados → dejar pasar (rutas sin restricción de feature)
  if (!moduleRoute || !featureRoute) return true;

  const active = branchContext.active();

  if (!active) {
    return router.createUrlTree(['/login']);
  }

  const feature: SessionFeatureDto | undefined = active.features.find(
    (f) => f.route === `${moduleRoute}/${featureRoute}`,
  );

  if (
    !feature ||
    !(feature.permissions.includes('*') || feature.permissions.includes(permission))
  ) {
    return router.createUrlTree(['/unauthorized']);
  }

  return true;
};
