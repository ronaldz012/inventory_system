import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { BranchContextService } from '@core/services/branch-context-service';
import { ConnectivityService } from '@core/services/connectivity-service';
import { ToastService } from '@core/services/toast-service';
import { environment } from 'environments/environment';
import {
  MonoTypeOperatorFunction,
  Observable,
  catchError,
  concatMap,
  switchMap,
  throwError,
  timeout,
  tap,
  timer,
} from 'rxjs';

const BACKEND_URL = environment.BACKEND_URL;

/** Presupuesto por intento: en redes débiles un request legítimo puede tardar. */
const REQUEST_TIMEOUT_MS = 8000;

/** Reintentos solo para lecturas idempotentes (GET). */
const MAX_GET_RETRIES = 2;
const RETRY_BASE_DELAYS_MS = [600, 1500];
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);

/**
 * Fallo de red o request muerta por timeout: lo único que apaga la conexión.
 * Un 429/500/404 prueba lo contrario (el servidor respondió).
 */
function isNetworkError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  const name = (error as { name?: string } | null)?.name;
  return status === 0 || name === 'TimeoutError';
}

function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status ?? -1;
  return isNetworkError(error) || RETRYABLE_STATUS.has(status);
}

/** Backoff con jitter (±30%) para que clientes en la misma red no fallen en fila. */
function backoffMs(attempt: number): number {
  const base = RETRY_BASE_DELAYS_MS[Math.min(attempt - 1, RETRY_BASE_DELAYS_MS.length - 1)];
  const jitter = 0.7 + Math.random() * 0.6;
  return Math.round(base * jitter);
}

/**
 * Reintenta lecturas (GET/HEAD) ante red rota, timeout, 5xx y 429. Cada
 * intento tiene su propio presupuesto de timeout. Solo notifica el error al
 * resto de la cadena cuando se agotan los reintentos.
 */
function withGetRetry<T>(): MonoTypeOperatorFunction<T> {
  let attempt = 0;
  return (source) =>
    source.pipe(
      timeout(REQUEST_TIMEOUT_MS),
      catchError((error: unknown, retried: Observable<T>) => {
        attempt += 1;
        if (attempt > MAX_GET_RETRIES || !isRetryableError(error)) {
          return throwError(() => error);
        }
        return timer(backoffMs(attempt)).pipe(concatMap(() => retried));
      }),
    );
}

/**
 * Estado de conexión: un éxito enciende, SOLO un fallo de red apaga. El error
 * sigue su curso (reintento agotado, toast, error inline) sin duplicar avisos.
 */
function withNetworkTracking<T extends HttpEvent<unknown>>(
  connectivity: ConnectivityService,
): MonoTypeOperatorFunction<T> {
  return (source) =>
    source.pipe(
      tap((event) => {
        // Solo una respuesta real del servidor enciende la conexión:
        // el stream también emite `Sent` al despachar (sin respuesta aún).
        if (event.type === HttpEventType.Response) connectivity.reportSuccess();
      }),
      catchError((error: unknown) => {
        if (isNetworkError(error)) connectivity.reportFailure();
        Object.assign(error as object, { __connectivityHandled: true });
        return throwError(() => error as HttpErrorResponse);
      }),
    );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth0 = inject(Auth0Service);
  const branchContext = inject(BranchContextService);
  const connectivity = inject(ConnectivityService);
  const toast = inject(ToastService);
  const router = inject(Router);

  if (req.url.includes('/api/Auth/health') || req.url.includes('gstatic.com/generate_204')) {
    return next(req);
  }

  if (!req.url.startsWith(BACKEND_URL)) {
    return next(req).pipe(timeout(REQUEST_TIMEOUT_MS), withNetworkTracking(connectivity));
  }

  const audience = environment.auth0.authorizationParams.audience;

  return auth0.getAccessTokenSilently({ authorizationParams: { audience } } as never).pipe(
    switchMap((token) => {
      if (!token) {
        return next(req).pipe(timeout(REQUEST_TIMEOUT_MS), withNetworkTracking(connectivity));
      }
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const existingBranchId = req.headers.get('X-Branch-Id');
      if (!existingBranchId) {
        const branchId = branchContext.getActiveBranchId();
        if (branchId) headers['X-Branch-Id'] = branchId;
      }
      const authReq = req.clone({ setHeaders: headers });
      // Solo lecturas idempotentes se reintentan solas; una venta duplicada no
      // se arregla con un retry (eso es trabajo del usuario o, a futuro, de
      // idempotency keys).
      const attempt = RETRYABLE_METHODS.has(req.method)
        ? next(authReq).pipe(withGetRetry())
        : next(authReq).pipe(timeout(REQUEST_TIMEOUT_MS));

      return attempt.pipe(withNetworkTracking(connectivity));
    }),
    catchError((error: unknown) => {
      if ((error as { __connectivityHandled?: boolean })?.__connectivityHandled) {
        return throwError(() => error as HttpErrorResponse);
      }
      const code = (error as { error?: string })?.error;
      if (
        code === 'login_required' ||
        code === 'missing_refresh_token' ||
        code === 'invalid_grant'
      ) {
        router.navigate(['/login'], { queryParams: { reason: 'session-expired' } });
      } else {
        console.warn('[auth] token silencioso falló sin sesión muerta:', code ?? error);
        toast.error('No pudimos validar tu sesión. Intentá de nuevo.');
      }
      return throwError(() => error as HttpErrorResponse);
    }),
  );
};
