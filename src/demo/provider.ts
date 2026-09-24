import { routeRequest } from '../domain/stops';
import { alignWalks, iso, journeyKey, time } from '../domain/journey';
import { Call, Journey, Leg, Place, TravelProvider, TransportMode } from '../domain/types';

export type Scenario = 'normal' | 'multimodal' | 'recovered' | 'tight' | 'delay' | 'connection' | 'cancelled' | 'missing' | 'network';
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'normal', label: 'I rute' }, { id: 'multimodal', label: 'Båt, trikk og tog' }, { id: 'recovered', label: 'Innhentet forsinkelse' }, { id: 'tight', label: 'Knapp overgang' }, { id: 'delay', label: 'Mistet overgang' },
  { id: 'connection', label: 'Neste buss forsinket' }, { id: 'cancelled', label: 'Innstilt buss' },
  { id: 'missing', label: 'Uten sanntid' }, { id: 'network', label: 'Nettverksfeil' },
];
export const DEMO_FROM: Place = { id: 'demo:start', name: 'Lohove', latitude: 63.405, longitude: 10.469 };
export const DEMO_TO: Place = { id: 'demo:end', name: 'Pirbadet', latitude: 63.440, longitude: 10.402 };
export const DEMO_WRONG_STOP: Place = { id: 'demo:wrong', name: 'Studentersamfundet', latitude: 63.422, longitude: 10.395 };
const BOARD: Place = { ...DEMO_FROM, name: 'Lohove holdeplass', quayId: 'demo:quay:1', platform: '1' };
const CHANGE: Place = { id: 'demo:change', name: 'Prinsens gate', latitude: 63.430, longitude: 10.392, quayId: 'demo:quay:2', platform: 'P1' };
const CHANGE2: Place = { ...CHANGE, quayId: 'demo:quay:3', platform: 'P2' };
const END: Place = { ...DEMO_TO, name: 'Pirterminalen', quayId: 'demo:quay:4' };

function leg(base: number, id: string, mode: TransportMode, from: Place, to: Place, start: number, end: number, line?: string): Leg {
  const l: Leg = { id, mode, from, to, aimedStart: iso(base + start * 60000), expectedStart: iso(base + start * 60000), aimedEnd: iso(base + end * 60000), expectedEnd: iso(base + end * 60000),
    duration: (end - start) * 60, distance: mode !== 'foot' ? 4200 : (end - start) * 75, line, headsign: to.name,
    checkedAt: Date.now(), quality: mode !== 'foot' ? 'realtime' : 'scheduled', cancelled: false,
    serviceJourneyId: mode !== 'foot' ? id : undefined, serviceDate: iso(base).slice(0, 10), fromPosition: 1, toPosition: 8 };
  if (mode !== 'foot') l.calls = callsFor(l);
  return l;
}
function callsFor(l: Leg): Call[] {
  return [
    { place: l.from, position: 1, aimedArrival: l.aimedStart, expectedArrival: l.expectedStart, aimedDeparture: l.aimedStart, expectedDeparture: l.expectedStart, realtime: l.quality === 'realtime', inaccurate: false, cancelled: l.cancelled, alighting: false },
    { place: l.to, position: 8, aimedArrival: l.aimedEnd, expectedArrival: l.expectedEnd, aimedDeparture: l.aimedEnd, expectedDeparture: l.expectedEnd, realtime: l.quality === 'realtime', inaccurate: false, cancelled: l.cancelled, alighting: true },
  ];
}
const journey = (legs: Leg[]): Journey => ({ id: journeyKey(legs), legs, fetchedAt: Date.now() });

export function demoJourneys(base: number): Journey[] {
  return [journey([
    leg(base, 'walk-a', 'foot', DEMO_FROM, BOARD, 3, 6),
    leg(base, 'demo:bus:first', 'bus', BOARD, CHANGE, 8, 20, '3'),
    leg(base, 'walk-b', 'foot', CHANGE, CHANGE2, 20, 22),
    leg(base, 'demo:bus:second', 'bus', CHANGE2, END, 29, 44, '25'),
    leg(base, 'walk-c', 'foot', END, DEMO_TO, 44, 47),
  ]), journey([
    leg(base, 'walk-d', 'foot', DEMO_FROM, BOARD, 5, 8),
    leg(base, 'demo:bus:direct', 'bus', BOARD, END, 13, 46, '12'),
    leg(base, 'walk-e', 'foot', END, DEMO_TO, 46, 49),
  ])];
}

export function applyScenario(j: Journey, scenario: Scenario, now = Date.now()): Journey {
  if (scenario === 'network') throw new Error('Simulert nettverksfeil. Sist kjente reise er bevart.');
  const legs = j.legs.map((l, i) => {
    if (scenario === 'multimodal' && l.mode !== 'foot' && l.serviceJourneyId !== 'demo:water') l = { ...l, mode: i === 1 ? 'tram' : 'rail', line: i === 1 ? '9' : 'R70' };
    if (l.mode === 'foot') return l;
    let delay = 0;
    if (l.serviceJourneyId === 'demo:bus:first') delay = scenario === 'tight' ? 5 : scenario === 'delay' ? 10 : scenario === 'connection' ? 8 : 0;
    if (l.serviceJourneyId === 'demo:bus:second' && scenario === 'connection') delay = 10;
    const updated: Leg = { ...l, expectedStart: iso(time(l.aimedStart) + (scenario === 'recovered' && l.serviceJourneyId === 'demo:bus:first' ? 4 : delay) * 60000), expectedEnd: iso(time(l.aimedEnd) + delay * 60000),
      cancelled: scenario === 'cancelled' && l.serviceJourneyId === 'demo:bus:first',
      quality: scenario === 'missing' ? 'scheduled' : 'realtime', checkedAt: now };
    updated.calls = l.serviceJourneyId === "demo:via:bus" ? l.calls : callsFor(updated);
    return updated;
  });
  if (scenario === 'multimodal' && !legs.some(l => l.mode === 'water')) {
    const last = legs[legs.length - 1];
    const base = time(last.expectedEnd);
    legs.push(leg(base, 'demo:water', 'water', last.to, DEMO_TO, 8, 18, '810'));
  }
  return alignWalks({ ...j, legs, fetchedAt: now });
}

export function demoProvider(base: number, scenario: Scenario): TravelProvider {
  return {
    async search(input) {
      const request = input.stops ? routeRequest(input) : input;
      if ((input.stops?.length || request.via?.length) && scenario !== 'network') {
        const start = Math.max(time(request.at), Date.now());
        const places = [request.from, ...(request.via ?? []), request.to];
        if (request.walkOnly) return [journey(places.slice(1).map((to, i) => leg(start, `demo:via:walk:${i}`, 'foot', places[i], to, i * 8, (i + 1) * 8)))];
        const bus = leg(start, 'demo:via:bus', 'bus', request.from, request.to, 3, places.length * 8, '3');
        bus.toPosition = places.length;
        bus.calls = places.map((place, i) => ({ place, position: i + 1, aimedArrival: iso(start + (3 + i * 8) * 60000), expectedArrival: iso(start + (3 + i * 8) * 60000), aimedDeparture: iso(start + (3 + i * 8) * 60000), expectedDeparture: iso(start + (3 + i * 8) * 60000), realtime: true, inaccurate: false, cancelled: false, alighting: i > 0 }));
        return [journey([bus]), ...(request.allowWalkOnly ? [journey(places.slice(1).map((to, i) => leg(start, `demo:via:walk:${i}`, 'foot', places[i], to, i * 12, (i + 1) * 12)))] : [])];
      }
      if (scenario === 'network') throw new Error('Simulert nettverksfeil. Prøv et annet scenario.');
      if (request.walkOnly) {
        const start = Math.max(time(request.at), Date.now());
        return [journey([leg(start, 'demo:walk:rest', 'foot', request.from, request.to, 0, 12)])];
      }
      if (request.allowWalkOnly) {
        const start = Math.max(time(request.at), Date.now());
        return [journey([leg(start, 'demo:walk:recovery', 'foot', request.from, request.from, 0, 2), leg(start, 'demo:bus:recovery', 'bus', request.from, END, 5, 19, '21'), leg(start, 'demo:walk:recovery-end', 'foot', END, request.to, 19, 22)]),
          { ...journey([leg(start, 'demo:walk:only', 'foot', request.from, request.to, 0, 28)]), id: 'demo:walk-only' }];
      }
      if (request.from.id === CHANGE.id) {
        const start = Math.max(time(request.at), Date.now());
        return [journey([leg(start, 'demo:walk:change', 'foot', request.from, CHANGE2, 0, 2), leg(start, 'demo:bus:replacement', 'bus', CHANGE2, END, 5, 24, '21'), leg(start, 'demo:walk:last', 'foot', END, DEMO_TO, 24, 27)])];
      }
      return demoJourneys(base).map(j => applyScenario(j, scenario));
    },
    async refresh(j, fromIndex) {
      const changed = applyScenario(j, scenario);
      return { ...changed, legs: changed.legs.map((l, i) => i < fromIndex ? j.legs[i] : l) };
    },
  };
}
