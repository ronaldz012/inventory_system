import { ActivatedRoute, Router } from '@angular/router';


export function openModal(router: Router, route: ActivatedRoute, modal: string): void {
  router.navigate([], {
    relativeTo: route,
    queryParams: { modal },
    queryParamsHandling: 'merge',
  });
}

export function swapModal(router: Router, route: ActivatedRoute, modal: string): void {
  router.navigate([], {
    relativeTo: route,
    queryParams: { modal },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

export function closeModal(router: Router, route: ActivatedRoute): void {
  router.navigate([], {
    relativeTo: route,
    queryParams: { modal: null },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

export function getModalId(modal: string | null, prefix: string): string | null {
  if (!modal || !modal.startsWith(prefix + ':')) return null;
  return modal.slice(prefix.length + 1);
}
