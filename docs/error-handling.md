# Error & Connectivity Handling Policy

This document describes how the app classifies request failures, how they are
surfaced to the user, and when requests are retried automatically. It was
introduced after real-world reports of "stuck" offline banners and repeated
manual retries on weak mobile connections.

## Principles

1. **A server response is connectivity.** If the backend answered — even with
   an error — the device is online. Only transport-level failures (status `0`,
   timeouts) may flip the connection state.
2. **Each surface reports its own failure.** A failed list shows an inline
   error; a failed action shows a toast. The global banner is *not* an error
   channel, it is a connection-state channel.
3. **Idempotent reads may retry silently; writes never do.** Automatic retries
   are limited to `GET` requests. Replaying a `POST` (e.g. creating a sale)
   risks duplicates and is left to the user (or, in the future, idempotency
   keys).

## Error classification

| Error | Meaning | Connection state touched? |
| --- | --- | --- |
| `status === 0` (network failure, CORS/DNS/reset) | Device could not reach the server | Yes — may go offline |
| `TimeoutError` (per-request budget of 8s) | Request did not finish in time | Yes — may go offline |
| `429`, `502`, `503`, `504` | Server responded, transient failure | No |
| `400/401/403/404/500` | Server responded with a decision | No |

`TimeoutError` from RxJS is matched by `error.name`; everything else by
`error.status`.

## Connection state & banner

Three states drive the banner in the main layout:

- `online` — default; no banner.
- `no-internet` — `navigator.onLine` is false, or the external probe
  (`https://www.gstatic.com/generate_204`) fails.
- `server-down` — the device has internet but `GET /api/Auth/health` does not
  answer within 3s.

**Turning the error state off (banner removal):**

1. Any successful backend response calls `reportSuccess()` — emitted only on
   `HttpEventType.Response`, never on `Sent`/progress events (see
   `withNetworkTracking`).
2. While in an error state, a health probe runs **every 20 seconds**
   (`ConnectivityService.scheduleProbe`); when it succeeds the state clears
   without any user action.
3. The browser `online` event clears it immediately.

**Toasts:** a throttled warning (max once per 5s) is shown only for genuine
network failures, so a stray 429 no longer produces "Sin conexión" notices.

## Retry policy (automatic)

Applied in `authInterceptor` for backend requests:

- **Methods:** `GET` / `HEAD` only.
- **Retryable:** network errors, timeouts, `429`, `502`, `503`, `504`.
- **Not retried:** `400/401/403/404/500` (valid answers), and **all non-idempotent
  methods** (`POST`, `PUT`, `PATCH`, `DELETE`) — duplicates cannot be undone by a
  retry.
- **Budget:** 2 retries with exponential backoff (~600ms → ~1.5s) and ±30%
  jitter, so clients on the same flaky network don't fail in lockstep.
- **Per-attempt timeout:** each retry gets its own 8s budget; the total worst
  case before the user sees an inline error is roughly 3s of waiting plus the
  final attempt.
- **Excluded endpoints:** `/api/Auth/health` and the external probe (they have
  their own lifecycle) and Auth0 token requests.

If retries are exhausted, the original error is propagated untouched: the list
renders its inline "Reintentar" state, or the action shows its toast.

## Surfaces

| Failure context | Surface |
| --- | --- |
| List / detail failed to load | Inline error card with **Reintentar** (per page) |
| Mutation failed (save, sell, adjust) | Toast |
| Connection lost / server unreachable | Global banner (above) + throttled toast |
| Retry succeeded after a transient failure | Nothing — the user should not notice |

## Implementation map

| Concern | File |
| --- | --- |
| Error classification, GET retry, connectivity tracking | `src/app/core/auth/auth-interceptor.ts` |
| Connection states, 20s recovery probe, throttled toasts | `src/app/core/services/connectivity-service.ts` |
| Offline banner rendering | `src/app/layout/maint-layout/main-layout.ts` (unchanged: it just reads the state) |

## Out of scope (phase 2)

- Offline queue for mutations (outbox pattern).
- Idempotency keys to enable safe automatic retries of `POST` requests.
- Visibility-aware probing (pausing the 20s probe while the tab is hidden).
- Distinguishing "slow network" from "broken network" to tune the 8s timeout.
