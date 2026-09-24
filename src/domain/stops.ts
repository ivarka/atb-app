import { ActiveJourney, Place, PlannedStop, SearchRequest } from './types';

export const isTransitStop = (p: Place) => !!(p.quayId || p.id?.startsWith('NSR:StopPlace:') || p.id?.startsWith('demo:'));
export const remainingStops = (a: Pick<ActiveJourney, 'stops'>) => (a.stops ?? []).filter(s => !s.visited);
export const nextPause = (a: Pick<ActiveJourney, 'stops'>) => remainingStops(a).find(s => s.mode === 'pause');
export function routeRequest(request: SearchRequest): SearchRequest {
  const pending = (request.stops ?? []).filter(s => !s.visited);
  const pause = pending.findIndex(s => s.mode === 'pause');
  return { ...request, to: pause < 0 ? request.to : pending[pause].place, via: (pause < 0 ? pending : pending.slice(0, pause)).map(s => s.place) };
}
export function activeRequest(a: ActiveJourney, request: SearchRequest): SearchRequest {
  return routeRequest({ ...request, to: a.destination, stops: a.stops });
}
export function samePlace(a: Place, b: Place) {
  if (a.id?.startsWith('NSR:StopPlace:') && b.id?.startsWith('NSR:StopPlace:')) return a.id === b.id;
  if (a.id && b.id && a.id === b.id) return true;
  const dy = (a.latitude - b.latitude) * 111320, dx = (a.longitude - b.longitude) * 111320 * Math.cos(a.latitude * Math.PI / 180);
  return Math.hypot(dx, dy) <= 75;
}
export function markStop(a: ActiveJourney, id: string): ActiveJourney {
  const first = remainingStops(a)[0];
  if (!first || first.id !== id) return a;
  const stops = (a.stops ?? []).map(s => s.id === id ? { ...s, visited: true } : s);
  if (first.mode === 'pause') return { ...a, stops, stay: { stopId: id, place: first.place }, progress: { ...a.progress, step: 'arrived', phase: 'alighted', needsReplan: false, legIndex: a.journey.legs.length } };
  const leg = a.journey.legs[a.progress.legIndex];
  if (a.progress.step === 'walking' && leg && samePlace(leg.to, first.place)) {
    const index = a.progress.legIndex + 1, next = a.journey.legs[index];
    return { ...a, stops, progress: { ...a.progress, legIndex: index, step: next?.mode === 'foot' ? 'walking' : next ? 'waiting' : 'arrived', place: first.place, locationVerified: true, confirmedAt: Date.now() } };
  }
  return { ...a, stops };
}
// Only actual departure evidence on the confirmed vehicle counts; predictions never do.
export function observedStops(a: ActiveJourney, now: number): ActiveJourney {
  let result = a;
  for (const stop of remainingStops(a)) {
    if (stop.mode === 'pause') break;
    const walked = a.journey.legs.some((leg, i) => leg.mode === 'foot' && samePlace(leg.to, stop.place) && i >= (a.routeStartIndex ?? 0) && i < a.progress.legIndex && !(a.progress.needsReplan && i === a.progress.legIndex - 1));
    const passed = walked || (isTransitStop(stop.place) && a.journey.legs.some((leg, i) => i >= (a.routeStartIndex ?? 0) && i <= a.progress.legIndex && leg.calls?.some(c => samePlace(c.place, stop.place) && c.position >= (leg.fromPosition ?? 0) && c.position <= (leg.toPosition ?? Infinity) &&
      ((i < a.progress.legIndex && !(a.progress.needsReplan && i === a.progress.legIndex - 1)) || (a.progress.phase === 'onboard' && leg.quality === 'realtime' && now - leg.checkedAt < 90000 && c.actualDeparture && Date.parse(c.actualDeparture) <= now)))));
    if (!passed) break;
    result = markStop(result, stop.id);
  }
  return result;
}
export const newStop = (place: Place, mode: PlannedStop['mode'] = 'direct'): PlannedStop => ({ id: `stop-${Date.now()}-${Math.random().toString(36).slice(2)}`, place, mode, visited: false });
