import { expect, it } from 'vitest';
import { supportedLeg, ATB_AUTHORITY, RAIL_AUTHORITY, TRIP_QUERY, updateLeg } from '../src/api/entur';
import { demoJourneys } from '../src/demo/provider';
import { alertsFor, feasible, journeyKey, transfers, transitLegs } from '../src/domain/journey';
import { stepsFor } from '../src/domain/progress';
import { ActiveJourney, TransportMode } from '../src/domain/types';
import { transport } from '../src/domain/transport';
for (const mode of ['bus', 'water', 'tram', 'rail'] as TransportMode[]) {
  it(`søk, fremdrift, overgang og oppdatering for ${mode}`, () => {
    const now = Date.now(), j = demoJourneys(now)[0];
    j.legs[1].mode = mode;
    expect(TRIP_QUERY).toContain(`transportMode: ${mode}`);
    expect(transitLegs(j)).toHaveLength(2);
    expect(transfers(j, now)).toHaveLength(1);
    expect(stepsFor(j).some(s => s.label.includes(transport[mode].name))).toBe(true);
    expect(journeyKey(j.legs)).toContain(j.legs[1].serviceJourneyId);
    const leg = updateLeg(j.legs[1], j.legs[1].calls!, now);
    expect(leg.mode).toBe(mode); expect(leg.quality).toBe('realtime');
    j.legs[1].cancelled = true;
    expect(feasible(j, now)).toBe(false);
    const a: ActiveJourney = { journey: j, origin: j.legs[0].from, destination: j.legs.at(-1)!.to, startedAt: now, demo: true, progress: { phase: 'waiting', legIndex: 0, confirmedAt: now } };
    expect(alertsFor(a, now)[0].title).toContain(transport[mode].title);
  });
}
it('tillater SJ Nord-tog og AtB-transport, men ikke fly eller uvedkommende operatører', () => {
  expect(supportedLeg('rail', RAIL_AUTHORITY)).toBe(true);
  expect(supportedLeg('water', ATB_AUTHORITY)).toBe(true);
  expect(supportedLeg('tram', ATB_AUTHORITY)).toBe(true);
  expect(supportedLeg('air', ATB_AUTHORITY)).toBe(false);
  expect(supportedLeg('bus', 'OTHER')).toBe(false);
});
