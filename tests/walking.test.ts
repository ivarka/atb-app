import { afterEach, expect, it, vi } from 'vitest';
import { entur, namePosition, WALK_QUERY } from '../src/api/entur';
import { demoJourneys, demoProvider, DEMO_FROM, DEMO_TO } from '../src/demo/provider';
import { recommend, replanContext } from '../src/domain/journey';
import { shortWalks, shouldCheckWalking } from '../src/domain/walking';
import { ActiveJourney } from '../src/domain/types';
afterEach(() => vi.unstubAllGlobals());
it('gir GPS et stedsnavn uten å flytte koordinatene til holdeplassen', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ features: [{ properties: { label: 'Munkegata, Trondheim', distance: .03, id: 'NSR:StopPlace:1' }, geometry: { coordinates: [1, 2] } }] }))));
  const result = await namePosition(DEMO_FROM);
  expect(result).toEqual({ source: 'gps', name: 'Ved Munkegata, Trondheim', latitude: DEMO_FROM.latitude, longitude: DEMO_FROM.longitude });
});
it('beholder brukbare GPS-koordinater ved feil i navneoppslaget', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
  const result = await namePosition(DEMO_FROM);
  expect(result.name).toContain('Posisjon ('); expect(result.latitude).toBe(DEMO_FROM.latitude);
});
it('foreslår raskere gange også under balansert femminuttersgrense', async () => {
  const now = Date.now(), journey = demoJourneys(now)[0];
  const active: ActiveJourney = { journey, origin: DEMO_FROM, destination: DEMO_TO, startedAt: now, demo: true, progress: { phase: 'waiting', legIndex: 0, confirmedAt: now } };
  const ctx = replanContext(active, now)!;
  const walk = (await demoProvider(now, 'normal').search({ ...ctx.request, walkOnly: true }))[0];
  walk.legs[0].expectedEnd = new Date(Date.parse(journey.legs.at(-1)!.expectedEnd) - 120000).toISOString();
  expect(recommend(active, [walk], ctx, 'balanced', now)?.reason).toContain('Raskere å gå resten');
  expect(replanContext({ ...active, progress: { ...active.progress, phase: 'alighted', place: DEMO_FROM } }, now, { place: DEMO_TO, timestamp: now, accuracy: 10 })?.request.from).toEqual(DEMO_TO);
});
it('begrenser automatiske gangforslag og beholder bussen man sitter på', async () => {
  const now = Date.now(), journey = demoJourneys(now)[0];
  const a: ActiveJourney = { journey, origin: DEMO_FROM, destination: DEMO_TO, startedAt: now, demo: true, progress: { phase: 'onboard', legIndex: 1, confirmedAt: now } };
  const ctx = replanContext(a, now)!;
  expect(ctx.prefix.at(-1)?.mode).toBe('bus'); expect(shouldCheckWalking(ctx)).toBe(true);
  const walk = (await demoProvider(now, 'normal').search({ ...ctx.request, walkOnly: true }))[0];
  expect(recommend(a, [walk], ctx, 'balanced', now)?.journey.legs[1].serviceJourneyId).toBe(journey.legs[1].serviceJourneyId);
  walk.legs[0].duration = 1801;
  expect(shortWalks([walk])).toEqual([]);
});
it('ber API-et om faktisk gangrute og forkaster eventuelle kollektivresultater', async () => {
  let query = '';
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => { query = JSON.parse(options.body).query; return new Response(JSON.stringify({ data: { trip: { tripPatterns: [{ legs: [{ mode: 'bus' }] }] } } })); }));
  expect(await entur.search({ from: DEMO_FROM, to: DEMO_TO, at: new Date().toISOString(), walkOnly: true })).toEqual([]);
  expect(query).toBe(WALK_QUERY); expect(query).toContain('directMode: foot'); expect(query).toContain('transportModes: []');
});
