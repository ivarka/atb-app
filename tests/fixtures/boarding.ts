import { ActiveJourney, Call, Position } from '../../src/domain/types';
export function boardingFixture(now: number) {
  const start = now - 60000;
  const place = (i: number) => ({ name: `Stopp ${i}`, latitude: 63.4 + i * .0032, longitude: 10.4 });
  const calls: Call[] = [0, 1, 2, 3].map(i => ({ place: place(i), position: i,
    aimedArrival: new Date(start + i * 30000).toISOString(), expectedArrival: new Date(start + i * 30000).toISOString(),
    aimedDeparture: new Date(start + i * 30000).toISOString(), expectedDeparture: new Date(start + i * 30000).toISOString(),
    realtime: true, inaccurate: false, cancelled: false, alighting: true }));
  const active: ActiveJourney = { origin: place(0), destination: place(3), startedAt: start - 1000, demo: false,
    progress: { phase: 'waiting', legIndex: 0, confirmedAt: start - 1000 },
    journey: { id: 'gps-test', fetchedAt: now, legs: [{ id: 'bus', mode: 'bus', from: place(0), to: place(3),
      aimedStart: calls[0].aimedDeparture, expectedStart: calls[0].expectedDeparture, aimedEnd: calls[3].aimedArrival, expectedEnd: calls[3].expectedArrival,
      duration: 90, distance: 1100, quality: 'realtime', checkedAt: now, cancelled: false, line: '3', fromPosition: 0, toPosition: 3, calls }] } };
  const samples: Position[] = Array.from({ length: 7 }, (_, i) => ({ place: place(i / 3), timestamp: start + i * 10000, accuracy: 10 }));
  return { active, samples };
}
