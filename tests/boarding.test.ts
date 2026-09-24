import { describe, expect, it } from 'vitest';
import { detectBoarding } from '../src/domain/boarding';
import { boardingFixture } from './fixtures/boarding';
const now = Date.now();
describe('påstigning fra GPS', () => {
  it('foreslår etter to stopp og registrerer etter tre', () => {
    const { active, samples } = boardingFixture(now);
    expect(detectBoarding(active, samples.slice(0, 4), now - 30000)?.confidence).toBe('suggest');
    expect(detectBoarding(active, samples, now)?.confidence).toBe('automatic');
  });
  it('avviser stillstand, unøyaktig GPS, gamle eller dupliserte posisjoner', () => {
    const { active, samples } = boardingFixture(now);
    for (const points of [samples.map(p => ({ ...p, place: samples[0].place })), samples.map(p => ({ ...p, accuracy: 200 })), samples.slice(0, 4), [...samples, samples[6]]])
      expect(detectBoarding(active, points, now)).toBeNull();
  });
  it('avviser gammel sanntid, innstilling og rutetider', () => {
    for (const patch of [{ checkedAt: now - 100000 }, { cancelled: true }, { quality: 'scheduled' as const }]) {
      const { active, samples } = boardingFixture(now);
      Object.assign(active.journey.legs[0], patch);
      expect(detectBoarding(active, samples, now)).toBeNull();
    }
  });
  it('krever observert påstigningsstopp og riktig retning', () => {
    const { active, samples } = boardingFixture(now);
    expect(detectBoarding(active, samples.slice(2), now)).toBeNull();
    expect(detectBoarding(active, samples.map((p, i) => ({ ...p, place: samples[6 - i].place })), now)).toBeNull();
  });
  it('avviser gange, GPS-hopp og avbrutt sporing', () => {
    const { active, samples } = boardingFixture(now);
    expect(detectBoarding(active, samples.map(p => ({ ...p, timestamp: now - (now - p.timestamp) * 5 })), now)).toBeNull();
    expect(detectBoarding(active, samples.map((p, i) => i === 2 ? { ...p, place: { ...p.place, latitude: 64 } } : p), now)).toBeNull();
    expect(detectBoarding(active, [samples[0], ...samples.slice(5)], now)).toBeNull();
  });
  it('bruker ikke GPS fra før bekreftet fremdrift', () => {
    const { active, samples } = boardingFixture(now);
    active.progress.confirmedAt = now - 20000;
    expect(detectBoarding(active, samples, now)).toBeNull();
  });
});
