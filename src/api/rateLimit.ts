/** One conservative budget for all Entur traffic (including autocomplete). */
import { nativeRuntime } from '../platform/nativeRuntime';
const KEY = 'underveis.entur-budget.v1';
const LOCK = 'underveis-entur-requests';
const WINDOW_MS = 60000;
const MAX_PER_MINUTE = 60;
const MAX_TRIPS_PER_MINUTE = 12;
const MIN_GAP_MS = 500;
const MAX_QUEUE = 12;
const MAX_QUEUE_AGE_MS = 15000;

type Budget = { calls: number[]; trips: number[]; blockedUntil: number };
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Lock = <T>(task: () => Promise<T>, signal?: AbortSignal) => Promise<T>;
type Options = { storage?: Store; lock?: Lock; fetch?: typeof fetch; now?: () => number };

export class RateLimitError extends Error {
  constructor(public readonly until: number) {
    const clock = new Date(until).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    super(`API-kall er satt på pause til ${clock}. Vent litt før du prøver igjen.`);
    this.name = 'RateLimitError';
  }
}

/** Respect both headers; Date compensates for client/server clock differences. */
export function cooldownUntil(headers: Headers, now: number): number {
  const serverDate = Date.parse(headers.get('Date') ?? '');
  const reference = Number.isFinite(serverDate) ? serverDate : now;
  const retry = headers.get('Retry-After');
  const retryNumber = retry !== null && /^\d+(\.\d+)?$/.test(retry.trim()) ? Number(retry) : NaN;
  const retryDate = Date.parse(retry ?? '');
  const expiry = Date.parse(headers.get('Rate-Limit-Expiry-Time') ?? '');
  const waits = [
    Number.isFinite(retryNumber) ? retryNumber * 1000 : retryDate - reference,
    expiry - reference,
  ].filter(ms => Number.isFinite(ms) && ms > 0);
  // Headers may not be exposed by CORS. Never spin when they are absent/invalid.
  return now + (waits.length ? Math.max(...waits) : WINDOW_MS) + 1000;
}

function abortError() { const error = new Error('Forespørselen ble avbrutt.'); error.name = 'AbortError'; return error; }
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw abortError(); }
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    checkAbort(signal);
    const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(done, ms);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(abortError()); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export function createEnturTransport(options: Options = {}) {
  const now = options.now ?? Date.now;
  let storage = options.storage;
  let memory: Budget = { calls: [], trips: [], blockedUntil: 0 };
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;

  function read(): Budget {
    let saved: Budget | undefined;
    try {
      const value = JSON.parse(storage?.getItem(KEY) ?? 'null');
      if (value && Array.isArray(value.calls) && Array.isArray(value.trips) && Number.isFinite(value.blockedUntil)) saved = value;
    } catch { storage = undefined; }
    const recent = (values: number[]) => values.filter(t => Number.isFinite(t) && t > now() - WINDOW_MS);
    return {
      calls: recent(saved?.calls ?? memory.calls), trips: recent(saved?.trips ?? memory.trips),
      blockedUntil: Math.max(memory.blockedUntil, saved?.blockedUntil ?? 0),
    };
  }
  function save(budget: Budget) {
    memory = budget;
    try { storage?.setItem(KEY, JSON.stringify(budget)); } catch { storage = undefined; }
  }

  async function execute(url: string, init: RequestInit, trip: boolean, queuedAt: number): Promise<Response> {
    const signal = init.signal ?? undefined;
    checkAbort(signal);
    let budget = read();
    if (budget.blockedUntil > now()) throw new RateLimitError(budget.blockedUntil);
    const quotaUntil = Math.max(
      budget.calls.length >= MAX_PER_MINUTE ? budget.calls[0] + WINDOW_MS + 1 : 0,
      trip && budget.trips.length >= MAX_TRIPS_PER_MINUTE ? budget.trips[0] + WINDOW_MS + 1 : 0,
    );
    if (quotaUntil > now()) throw new RateLimitError(quotaUntil);
    if (now() - queuedAt >= MAX_QUEUE_AGE_MS) throw new Error('Forespørselen ventet for lenge. Prøv igjen.');
    const last = budget.calls.at(-1);
    const gap = last === undefined ? 0 : last + MIN_GAP_MS - now();
    if (gap > MAX_QUEUE_AGE_MS) throw new RateLimitError(last! + MIN_GAP_MS);
    if (gap > 0) await wait(gap, signal);
    checkAbort(signal);
    // Drop old queued work instead of replaying a burst after a slow response.
    if (now() - queuedAt >= MAX_QUEUE_AGE_MS) throw new Error('Forespørselen ventet for lenge. Prøv igjen.');
    budget = read();
    if (budget.blockedUntil > now()) throw new RateLimitError(budget.blockedUntil);
    const started = now();
    save({ ...budget, calls: [...budget.calls, started], trips: trip ? [...budget.trips, started] : budget.trips });

    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await (options.fetch ?? fetch)(url, { ...init, signal: controller.signal });
      const quotaEmpty = response.headers.get('Rate-Limit-Available') === '0';
      if (response.status === 429 || quotaEmpty) {
        const until = cooldownUntil(response.headers, now());
        save({ ...read(), blockedUntil: Math.max(read().blockedUntil, until) });
        if (response.status === 429) {
          await response.body?.cancel();
          throw new RateLimitError(until);
        }
      }
      // Keep the timeout and lock until the body is received as well.
      // Entur endpoints return JSON. Text also preserves UTF-8 in React Native's fetch polyfill.
      const body = await response.text();
      return new Response([204, 205, 304].includes(response.status) ? null : body, {
        status: response.status, statusText: response.statusText, headers: response.headers,
      });
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  return function request(url: string, init: RequestInit = {}, trip = false): Promise<Response> {
    const signal = init.signal ?? undefined;
    if (signal?.aborted) return Promise.reject(abortError());
    const budget = read();
    if (budget.blockedUntil > now()) return Promise.reject(new RateLimitError(budget.blockedUntil));
    if (pending >= MAX_QUEUE) return Promise.reject(new Error('Mange forespørsler venter allerede. Vent litt før du prøver igjen.'));
    pending++;
    const queuedAt = now();
    const run = () => {
      checkAbort(signal);
      const task = () => execute(url, init, trip, queuedAt);
      return options.lock ? options.lock(task, signal) : task();
    };
    const result = tail.then(run);
    tail = result.catch(() => undefined);
    return result.finally(() => { pending--; });
  };
}

function browserOptions(): Options {
  let storage: Store | undefined;
  try { if (typeof localStorage !== 'undefined') storage = localStorage; } catch { /* Restricted browser storage. */ }
  const lock: Lock | undefined = typeof navigator !== 'undefined' && navigator.locks
    ? (task, signal) => navigator.locks.request(LOCK, { mode: 'exclusive', signal }, task)
    : undefined;
  // Without an atomic lock, shared counters could overwrite one another.
  return { storage: lock || nativeRuntime ? storage : undefined, lock };
}

export const enturRequest = createEnturTransport(browserOptions());
