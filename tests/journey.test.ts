import { describe, expect, it } from 'vitest';
import { applyScenario, demoJourneys, demoProvider, DEMO_FROM, DEMO_TO } from '../src/demo/provider';
import { alertsFor, feasible, iso, rankJourneys, recommend, replanContext, transfers } from '../src/domain/journey';
import { ActiveJourney, Journey } from '../src/domain/types';
const now = Date.now();
function active(journey: Journey = demoJourneys(now)[0]): ActiveJourney {
  return { journey, origin: DEMO_FROM, destination: DEMO_TO, startedAt: now, progress: { phase: 'waiting', legIndex: 0, confirmedAt: now }, demo: true, demoBase: now };
}

describe('overganger og datakvalitet', () => {
  it('trekker fra nødvendig gangtid', () => expect(transfers(demoJourneys(now)[0], now)[0].margin).toBe(7));
  it('varsler om knapp overgang', () => expect(transfers(applyScenario(demoJourneys(now)[0], 'tight', now), now)[0].status).toBe('tight'));
  it('varsler om tapt overgang og beholder valgt reise', () => {
    const original = demoJourneys(now)[0];
    const delayed = applyScenario(original, 'delay', now);
    expect(delayed.id).toBe(original.id);
    expect(transfers(delayed, now)[0].status).toBe('missed');
    expect(alertsFor(active(delayed), now).some(a => a.title === 'Du ser ikke ut til å rekke overgangen')).toBe(true);
  });
  it('tar med forsinkelsen til overgangsbussen', () => expect(transfers(applyScenario(demoJourneys(now)[0], 'connection', now), now)[0].status).toBe('good'));
  it('presenterer ikke rutetid eller foreldet sanntid som trygg', () => {
    expect(transfers(applyScenario(demoJourneys(now)[0], 'missing', now), now)[0].status).toBe('unknown');
    expect(transfers(demoJourneys(now)[0], now + 120000)[0].status).toBe('unknown');
  });
  it('innstilling utelukkes fra gjennomførbare alternativer', () => expect(feasible(applyScenario(demoJourneys(now)[0], 'cancelled', now), now)).toBe(false));
  it('utløser samme varselidentitet ved gjentatte oppdateringer', () => {
    const a = active(applyScenario(demoJourneys(now)[0], 'delay', now));
    expect(alertsFor(a, now).map(a => a.id)).toEqual(alertsFor(a, now + 30000).map(a => a.id));
  });
  it('avviser avgang som ikke kan nås etter gangtiden', () => {
    const j = demoJourneys(now)[0];
    expect(feasible(j, now + 7 * 60000)).toBe(false);
  });
  it('markerer nettverksfeil uten å endre opprinnelig reise', () => {
    const j = demoJourneys(now)[0]; const before = JSON.stringify(j);
    expect(() => applyScenario(j, 'network', now)).toThrow(); expect(JSON.stringify(j)).toBe(before);
  });
});

describe('prioritering og omplanlegging', () => {
  it('raskest velger tidligere ankomst, tryggest velger direkteruten', () => {
    const js = demoJourneys(now);
    expect(rankJourneys(js, 'fastest', now)[0].id).toBe(js[0].id);
    expect(rankJourneys(js, 'safest', now)[0].id).toBe(js[1].id);
  });
  it('balansert beholder reisen uten tilstrekkelig forbedring', () => {
    const a = active(); const ctx = replanContext(a, now)!;
    expect(recommend(a, demoJourneys(now), ctx, 'balanced', now)).toBeNull();
  });
  it('foreslår en annen buss når overgangen ryker uten å bytte aktiv reise', () => {
    const a = active(applyScenario(demoJourneys(now)[0], 'delay', now));
    const before = a.journey.id;
    const r = recommend(a, demoJourneys(now), replanContext(a, now)!, 'balanced', now);
    expect(r?.journey.legs.some(l => l.line === '12')).toBe(true);
    expect(a.journey.id).toBe(before);
  });
  it('tryggest foreslår færre bytter', () => {
    const a = active();
    expect(recommend(a, demoJourneys(now), replanContext(a, now)!, 'safest', now)?.reason).toBe('Færre bytter');
  });
  it('raskest foreslår også en liten tidsgevinst', () => {
    const js = demoJourneys(now); const a = active(js[1]);
    expect(recommend(a, js, replanContext(a, now)!, 'fastest', now)).not.toBeNull();
    expect(recommend(a, js, replanContext(a, now)!, 'balanced', now)).toBeNull();
  });
  it('bruker fersk presis GPS før påstigning, ignorerer gammel posisjon', () => {
    const a = active(); const gps = { place: DEMO_TO, timestamp: now, accuracy: 20 };
    expect(replanContext(a, now, gps)?.request.from).toBe(DEMO_TO);
    expect(replanContext(a, now, { ...gps, timestamp: now - 120000 })?.request.from).toBe(DEMO_FROM);
  });
  it('beholder bussen du er om bord i og søker fra en fremtidig avstigning', async () => {
    const a = active(applyScenario(demoJourneys(now)[0], 'delay', now));
    a.progress = { phase: 'onboard', legIndex: 1, confirmedAt: now };
    const ctx = replanContext(a, now)!;
    expect(ctx.request.from.name).toBe('Prinsens gate');
    const options = await demoProvider(now, 'delay').search(ctx.request);
    const r = recommend(a, options, ctx, 'balanced', now)!;
    expect(r.journey.legs[1].serviceJourneyId).toBe(a.journey.legs[1].serviceJourneyId);
    expect(r.progress.phase).toBe('onboard');
    expect(r.progress.legIndex).toBe(1);
  });
  it('søker aldri fra passerte stopp eller med usikre omborddata', () => {
    const a = active(); a.progress = { phase: 'onboard', legIndex: 1, confirmedAt: now };
    a.journey.legs[1].calls![1].expectedArrival = iso(now - 60000);
    expect(replanContext(a, now)).toBeNull();
    a.journey.legs[1].quality = 'scheduled'; expect(replanContext(a, now)).toBeNull();
  });
  it('bruker ikke en usikker prognose for et mulig avstigningsstopp', () => {
    const a = active(); a.progress = { phase: 'onboard', legIndex: 1, confirmedAt: now };
    a.journey.legs[1].calls![1].inaccurate = true;
    expect(replanContext(a, now)).toBeNull();
  });
  it('bruker bekreftet avstigningssted etter avstigning', () => {
    const a = active(); const stop = a.journey.legs[1].to;
    a.progress = { phase: 'alighted', legIndex: 2, place: stop, confirmedAt: now };
    expect(replanContext(a, now)?.request.from).toEqual(stop);
  });
});
