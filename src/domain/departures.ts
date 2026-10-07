import { ActiveJourney, Call, Departure, Journey, Leg, PendingRide, Place, PlannedStop, Position, Preference, TravelProvider } from './types';
import { distance } from './boarding';
import { feasible, journeyKey, rankJourneys } from './journey';
import { isTransitStop, routeRequest, samePlace } from './stops';
export function departureLeg(d: Departure, to?: Call, calls: Call[] = []): Leg {
 return { id: `${d.id}-${to?.position ?? d.position}`, mode: d.mode, from: d.place, to: to?.place ?? d.place,
 aimedStart: d.aimed, expectedStart: d.expected, aimedEnd: to?.aimedArrival ?? d.aimed, expectedEnd: to?.expectedArrival ?? d.expected,
 duration: Math.max(0, (Date.parse(to?.expectedArrival ?? d.expected)-Date.parse(d.expected))/1000), distance: 0,
 quality: to ? (to.inaccurate ? 'uncertain' : to.realtime && d.quality === 'realtime' ? 'realtime' : 'scheduled') : d.quality, checkedAt: d.checkedAt, cancelled: d.cancelled, line: d.line, headsign: d.headsign,
 serviceJourneyId: d.serviceJourneyId, serviceDate: d.serviceDate, fromPosition: d.position, toPosition: to?.position ?? d.position, calls };
}
export function confirmedRide(d: Departure, destination: Place, now: number, previous: ActiveJourney | null, demo: boolean): ActiveJourney {
 const leg = departureLeg(d);
 return { journey: { id: d.id, legs: [leg], fetchedAt: now }, destination, origin: d.place, stops: previous?.stops ?? [], startedAt: now, demo,
 pendingRide: { departure: d, previousExit: previous?.journey.legs[previous.progress.legIndex]?.to },
 progress: { phase: 'onboard', step: 'onboard', legIndex: 0, confirmedAt: now, needsReplan: true } };
}
export function upcomingPosition(ride: PendingRide, calls: Call[], now: number, checkedAt: number, position?: Position): number | undefined {
 const afterBoarding = calls.filter(c => c.position > ride.departure.position);
 if (now - checkedAt >= 90000) return undefined;
 const actual = calls.filter(c => c.realtime && !c.inaccurate && c.actualDeparture && Date.parse(c.actualDeparture) <= now).at(-1)?.position;
 let next = actual === undefined ? undefined : afterBoarding.find(c => c.position > actual)?.position;
 if (ride.nextPosition !== undefined && ride.nextConfirmedAt && now - ride.nextConfirmedAt < 90000) next = Math.max(next ?? ride.nextPosition, ride.nextPosition);
 if (position && now - position.timestamp >= 0 && now - position.timestamp < 30000 && position.accuracy <= 35) {
  const matches = afterBoarding.filter(c => distance(c.place, position.place) <= 50);
  if (matches.length === 1) next = Math.max(next ?? matches[0].position, matches[0].position);
 }
 return next;
}
export function candidateExits(calls: Call[], minPosition: number, destination: Place, stops: PlannedStop[], previousExit?: Place): Call[] {
 let upcoming = calls.filter(c => c.position >= minPosition && c.alighting && !c.cancelled && !c.actualDeparture);
 const pause = stops.find(s => !s.visited && s.mode === 'pause');
 const pauseCall = pause && upcoming.find(c => samePlace(c.place, pause.place));
 if (pauseCall) upcoming = upcoming.filter(c => c.position <= pauseCall.position);
 if (!upcoming.length) return [];
 const target = stops.find(s => !s.visited)?.place ?? destination;
 const closest = [...upcoming].sort((a,b) => distance(a.place,target)-distance(b.place,target))[0];
 const third = upcoming.find(c => previousExit && samePlace(c.place,previousExit)) ?? upcoming.at(-1)!;
 return [...new Map([upcoming[0],closest,third].map(c => [c.position,c])).values()];
}
export async function routesWithDeparture(d: Departure, calls: Call[], minPosition: number, destination: Place, stops: PlannedStop[], preference: Preference, provider: TravelProvider, onboard: boolean, previousExit?: Place, valid: () => boolean = () => true): Promise<Journey[]> {
 const results: Journey[] = []; let lastError: unknown;
 for (const exit of candidateExits(calls,minPosition,destination,stops,previousExit)) {
  if (!valid()) return [];
  const prefix = departureLeg(d,exit,calls);
  // Only ordered pass-through stops fulfilled by this vehicle may be removed from the suffix request.
  let lastPosition = d.position, blocked = false;
  const rest = stops.map(s => {
   if (s.visited || blocked) return s;
   const c = isTransitStop(s.place) && calls.find(c => c.position >= lastPosition && c.position <= exit.position && samePlace(c.place,s.place));
   if (s.mode === 'direct' && c) { lastPosition = c.position; return { ...s, visited: true }; }
   blocked = true; return s;
  });
  const at = Math.max(Date.now(),Date.parse(exit.expectedArrival));
  const request = routeRequest({ from: exit.place, to: destination, at: new Date(at + 60000).toISOString(), stops: rest, allowWalkOnly: true });
  try {
   const suffixes = !request.via?.length && samePlace(exit.place,request.to) ? [{ id: 'end', legs: [], fetchedAt: Date.now() }] : await provider.search(request);
   if (!valid()) return [];
   for (const suffix of suffixes) {
    if (suffix.legs.length && !feasible(suffix,at)) continue;
    const legs = [prefix,...suffix.legs];
    if (!onboard && Date.parse(d.expected) <= Date.now()) continue;
    results.push({ id: journeyKey(legs), legs, fetchedAt: Date.now() });
   }
  } catch (e) { lastError = e; }
 }
 if (!results.length && lastError) throw lastError;
 return rankJourneys([...new Map(results.map(j => [j.id,j])).values()],preference,Date.now()).slice(0,3);
}
