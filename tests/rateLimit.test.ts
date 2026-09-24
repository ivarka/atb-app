import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cooldownUntil, createEnturTransport, RateLimitError } from '../src/api/rateLimit';

const epoch = Date.parse('2026-09-18T12:00:00Z');
const ok = () => new Response('{}');
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(epoch); });
afterEach(() => vi.useRealTimers());

function shared() {
  const data = new Map<string, string>();
  let tail: Promise<unknown> = Promise.resolve();
  return {
    storage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } },
    lock: <T>(task: () => Promise<T>): Promise<T> => {
      const result = tail.then(task); tail = result.catch(() => undefined); return result;
    },
  };
}

describe('felles begrensning', () => {
  it('fordeler samtidige kall med minst et halvt sekund mellom startene', async () => {
    const starts: number[] = [];
    const request = createEnturTransport({ fetch: vi.fn(async () => { starts.push(Date.now()); return ok(); }) });
    const result = Promise.all([request('/a'), request('/b'), request('/c')]);
    await vi.runAllTimersAsync(); await result;
    expect(starts).toEqual([epoch, epoch + 500, epoch + 1000]);
  });

  it('stopper etter 12 reisesøk, men tillater sanntidskall', async () => {
    const fetch = vi.fn(async () => ok()); const request = createEnturTransport({ fetch });
    for (let i = 0; i < 12; i++) { const p = request('/trip', {}, true); await vi.runAllTimersAsync(); await p; }
    await expect(request('/trip', {}, true)).rejects.toBeInstanceOf(RateLimitError);
    const p = request('/calls'); await vi.runAllTimersAsync(); await p;
    expect(fetch).toHaveBeenCalledTimes(13);
    await vi.advanceTimersByTimeAsync(60000);
    await request('/trip', {}, true); expect(fetch).toHaveBeenCalledTimes(14);
  });

  it('har et samlet tak på 60 kall i et rullerende minutt', async () => {
    const fetch = vi.fn(async () => ok()); const request = createEnturTransport({ fetch });
    for (let i = 0; i < 60; i++) { const p = request('/calls'); await vi.runAllTimersAsync(); await p; }
    await expect(request('/calls')).rejects.toBeInstanceOf(RateLimitError);
    expect(fetch).toHaveBeenCalledTimes(60);
  });

  it('deler budsjett mellom to klienter/faner', async () => {
    const state = shared(); const starts: number[] = [];
    const fetch = vi.fn(async () => { starts.push(Date.now()); return ok(); });
    const a = createEnturTransport({ ...state, fetch }); const b = createEnturTransport({ ...state, fetch });
    for (let i = 0; i < 6; i++) {
      const p = Promise.all([a('/trip', {}, true), b('/trip', {}, true)]);
      await vi.runAllTimersAsync(); await p;
    }
    await expect(b('/trip', {}, true)).rejects.toBeInstanceOf(RateLimitError);
    expect(starts).toHaveLength(12);
    expect(starts.every((t, i) => !i || t - starts[i - 1] >= 500)).toBe(true);
  });

  it('sender ikke et avbrutt stedssøk som venter i kø', async () => {
    const fetch = vi.fn(async () => ok()); const request = createEnturTransport({ fetch });
    await request('/first');
    const controller = new AbortController();
    const p = request('/geocoder', { signal: controller.signal });
    const check = expect(p).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await vi.runAllTimersAsync(); await check;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('begrenser køen og forkaster arbeid som ble for gammelt', async () => {
    let release!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
    const request = createEnturTransport({ fetch });
    const first = request('/first'); await vi.advanceTimersByTimeAsync(0);
    const queued = Array.from({ length: 11 }, () => request('/queued').catch(e => e));
    await expect(request('/overflow')).rejects.toThrow('Mange forespørsler');
    vi.setSystemTime(epoch + 16000); release(ok()); await first;
    const result = await Promise.all(queued);
    expect(result.every(e => e.message.includes('ventet for lenge'))).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('beholder lokal begrensning hvis lagring feiler', async () => {
    const request = createEnturTransport({ fetch: vi.fn(async () => ok()), storage: { getItem: () => null, setItem: () => { throw new Error('full'); } } });
    for (let i = 0; i < 12; i++) { const p = request('/trip', {}, true); await vi.runAllTimersAsync(); await p; }
    await expect(request('/trip', {}, true)).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe('429 og kvoteventing', () => {
  it('velger den lengste ventetiden fra Retry-After og kvoteutløp', () => {
    const headers = new Headers({ 'Retry-After': '15', 'Rate-Limit-Expiry-Time': new Date(epoch + 90000).toUTCString() });
    expect(cooldownUntil(headers, epoch)).toBe(epoch + 91000);
  });
  it('forstår HTTP-dato og tar hensyn til forskjellig serverklokke', () => {
    const headers = new Headers({ Date: new Date(epoch - 30000).toUTCString(), 'Retry-After': new Date(epoch + 30000).toUTCString() });
    expect(cooldownUntil(headers, epoch)).toBe(epoch + 61000);
  });
  it.each<Record<string, string>>([{}, { 'Retry-After': 'nonsense' }, { 'Rate-Limit-Expiry-Time': new Date(epoch - 1000).toUTCString() }])('venter minst et minutt uten brukbare eller CORS-eksponerte headere (%j)', headers => {
    expect(cooldownUntil(new Headers(headers), epoch)).toBe(epoch + 61000);
  });
  it('stanser køen, andre faner og nye kall uten automatisk retry', async () => {
    const state = shared();
    const fetch = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    const a = createEnturTransport({ ...state, fetch }); const b = createEnturTransport({ ...state, fetch });
    const results = Promise.allSettled([a('/trip'), a('/queued'), b('/other-tab')]);
    await vi.runAllTimersAsync();
    expect((await results).every(r => r.status === 'rejected' && r.reason instanceof RateLimitError)).toBe(true);
    await expect(b('/new')).rejects.toBeInstanceOf(RateLimitError);
    await vi.advanceTimersByTimeAsync(120000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(a('/too-soon')).rejects.toBeInstanceOf(RateLimitError);
    await vi.advanceTimersByTimeAsync(1000);
    fetch.mockImplementation(async () => ok());
    await b('/after-expiry'); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('stopper proaktivt etter et vellykket svar med tom kvote', async () => {
    const fetch = vi.fn(async () => new Response('{}', { headers: { 'Rate-Limit-Available': '0', 'Retry-After': '30' } }));
    const request = createEnturTransport({ fetch });
    expect((await request('/last-allowed')).ok).toBe(true);
    await expect(request('/next')).rejects.toBeInstanceOf(RateLimitError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
