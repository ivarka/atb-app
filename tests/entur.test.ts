import { afterEach, describe, expect, it, vi } from 'vitest';
import { entur, updateLeg } from '../src/api/entur';
import { demoJourneys } from '../src/demo/provider';

afterEach(() => vi.unstubAllGlobals());
describe('oppdatering av en konkret avgang', () => {
  it('matcher stoppets posisjon også når plattformen endres', () => {
    const l = demoJourneys(Date.now())[0].legs[1];
    const calls = l.calls!.map(c => ({ ...c, place: { ...c.place, quayId: 'ny-plattform', platform: 'P9' } }));
    expect(updateLeg(l, calls, Date.now()).from.platform).toBe('P9');
    expect(updateLeg(l, calls, Date.now()).serviceJourneyId).toBe(l.serviceJourneyId);
  });
  it('bevarer data og merker dem som foreldet når avgangen mangler', () => {
    const l = demoJourneys(Date.now())[0].legs[1];
    const next = updateLeg(l, [], Date.now());
    expect(next.quality).toBe('stale'); expect(next.expectedEnd).toBe(l.expectedEnd);
  });
  it('bruker driftsdato, ikke dagens kalenderdato', async () => {
    const j = demoJourneys(Date.now())[0];
    j.legs[1].serviceDate = '2026-09-17';
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => { calls.push(JSON.parse(options.body)); return new Response(JSON.stringify({ data: { serviceJourney: { estimatedCalls: [] } } })); }));
    const result = await entur.refresh(j, 0);
    expect(calls[0].variables.date).toBe('2026-09-17');
    expect(result.id).toBe(j.id);
    expect(result.legs[1].quality).toBe('stale');
  });
});
