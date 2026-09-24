import { afterEach, describe, expect, it, vi } from 'vitest';
import { afterAlighting, alightingPlace, detectAlighting, usablePosition } from '../src/domain/alighting';
import { alertsFor } from '../src/domain/journey';
import { initialProgress, onboardTiming, stepIndex, stepsFor } from '../src/domain/progress';
import { applyScenario, demoJourneys, DEMO_FROM, DEMO_TO, DEMO_WRONG_STOP } from '../src/demo/provider';
import { ActiveJourney, Position } from '../src/domain/types';
import { loadSaved } from '../src/platform/storage';
const now = Date.now();
function active(): ActiveJourney {
  return { journey: demoJourneys(now)[0], origin: DEMO_FROM, destination: DEMO_TO, startedAt: now - 120000, demo: true,
    progress: { phase: 'onboard', step: 'onboard', legIndex: 1, confirmedAt: now - 120000 } };
}
afterEach(() => vi.unstubAllGlobals());
describe('fremdrift og forsinkelse', () => {
  it('viser avgang før påstigning og ankomst mens man er om bord', () => {
    const a = active(); a.journey = applyScenario(a.journey, 'recovered', now);
    expect(alertsFor(a, now).some(a => a.id.startsWith('delay:'))).toBe(false);
    expect(onboardTiming(a, now)).toContain('i rute');
    a.progress = initialProgress(a.journey, now);
    expect(alertsFor(a, now).find(a => a.id.startsWith('delay:'))?.title).toContain('fra Lohove holdeplass');
  });
  it('viser ny forsinkelse ved avstigningsstedet og aldri i rute med gamle data', () => {
    const a = active(); a.journey = applyScenario(a.journey, 'tight', now);
    expect(alertsFor(a, now)[0].title).toContain('5 min forsinket til Prinsens gate');
    expect(onboardTiming(a, now + 100000)).toContain('Usikker vurdering');
  });
  it('har eksplisitte gå-, vente-, buss- og ankomststeg uten klokkeprogresjon', () => {
    const a = active();
    expect(stepsFor(a.journey).map(s => s.kind)).toEqual(['walking', 'waiting', 'onboard', 'walking', 'waiting', 'onboard', 'walking', 'arrived']);
    expect(stepIndex(a)).toBe(2);
    a.journey.legs.splice(2, 1);
    expect(stepsFor(a.journey).filter(s => s.kind === 'waiting')).toHaveLength(2);
  });
  it('krever ny videreplan ved tidlig og sen avstigning, også etter siste buss', () => {
    const a = active();
    expect(afterAlighting(a, DEMO_WRONG_STOP, now).progress.needsReplan).toBe(true);
    a.progress.legIndex = 3;
    const updated = afterAlighting(a, DEMO_WRONG_STOP, now);
    expect(updated.progress.place).toEqual(DEMO_WRONG_STOP);
    expect(updated.progress.needsReplan).toBe(true);
    expect(alertsFor(updated, now)).toEqual([]);
  });
  it('beholder gjennomførbar reise ved planlagt stopp, men ikke mistet viderebuss', () => {
    const a = active(), stop = a.journey.legs[1].to;
    expect(afterAlighting(a, stop, now).progress.needsReplan).toBe(false);
    expect(afterAlighting(a, stop, now + 40 * 60000).progress.needsReplan).toBe(true);
  });
  it('bevarer faktiske koordinater uten å knytte søket til en plattform', () => {
    const a = active(), stop = a.journey.legs[1].to;
    const p = { place: { ...stop, latitude: stop.latitude + .0001 }, timestamp: now, accuracy: 10 };
    expect(alightingPlace(a, p)).toEqual({ name: stop.name, latitude: p.place.latitude, longitude: stop.longitude });
    expect(usablePosition({ ...p, timestamp: now - 30000 }, now)).toBe(false);
    expect(usablePosition({ ...p, accuracy: 51 }, now)).toBe(false);
  });
  it('migrerer gammel lagring uten å anta bekreftet avstigningssted', () => {
    const a = active(); a.progress = { phase: 'alighted', legIndex: 2, confirmedAt: now, place: a.journey.legs[1].to };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ version: 1, preference: 'balanced', active: a }) });
    const saved = loadSaved()!;
    expect(saved.active?.progress).toMatchObject({ step: 'walking', needsReplan: true, locationVerified: false });
    expect(saved.active?.progress.place).toBeUndefined();
  });
});
describe('foreslått avstigning', () => {
  function fixture() {
    const a = active(), stop = a.journey.legs[1].to;
    const samples: Position[] = [0, 1, 2, 3].map(i => ({ place: { ...stop, latitude: stop.latitude + i * .00025 }, timestamp: now - 60000 + i * 20000, accuracy: 10 }));
    return { a, samples };
  }
  it('foreslår ved gangfart bort fra et observert stopp, uten å endre fremdrift', () => {
    const { a, samples } = fixture();
    expect(detectAlighting(a, samples, now)).not.toBeNull();
    expect(a.progress.phase).toBe('onboard');
  });
  it('stillstand alene, GPS-hopp og gamle posisjoner gir ikke forslag', () => {
    const { a, samples } = fixture();
    expect(detectAlighting(a, samples.map(p => ({ ...p, place: samples[0].place })), now)).toBeNull();
    expect(detectAlighting(a, samples.map((p, i) => i === 1 ? { ...p, place: DEMO_FROM } : p), now)).toBeNull();
    expect(detectAlighting(a, samples, now + 60000)).toBeNull();
  });
  it('kan foreslå etter at bussen har kjørt og brukeren har blitt igjen', () => {
    const { a, samples } = fixture();
    a.journey.legs[1].calls![1].actualDeparture = new Date(now - 60000).toISOString();
    expect(detectAlighting(a, samples.map(p => ({ ...p, place: samples[0].place })), now)).not.toBeNull();
    a.journey.legs[1].quality = 'stale';
    expect(detectAlighting(a, samples, now)).toBeNull();
  });
});
