import { ActiveJourney, Place, Position } from './types';
import { distance } from './boarding';
import { feasible, isFresh } from './journey';
export type AlightingEvidence = { key: string; place: Place; createdAt: number };
export const usablePosition = (p: Position | undefined, now: number): p is Position => !!p && Number.isFinite(p.place.latitude) && Number.isFinite(p.place.longitude) && p.accuracy >= 0 && p.accuracy <= 50 && now - p.timestamp >= 0 && now - p.timestamp < 30000;
export function alightingPlace(active: ActiveJourney, p: Position): Place {
  const leg = active.journey.legs[active.progress.legIndex];
  const matches = (leg?.calls ?? []).filter(c => distance(c.place, p.place) <= 75);
  const names = new Set(matches.map(c => c.place.id ?? c.place.name));
  // Preserve coordinates: attaching a quay ID would snap Entur's search origin.
  return { latitude: p.place.latitude, longitude: p.place.longitude, name: names.size === 1 ? matches[0].place.name : 'Din posisjon ved avstigning' };
}
export function afterAlighting(active: ActiveJourney, place: Place, now: number): ActiveJourney {
  const legIndex = active.progress.legIndex + 1;
  const planned = active.journey.legs[active.progress.legIndex]?.to;
  const next = active.journey.legs[legIndex];
  const atPlanned = !!planned && distance(place, planned) <= 75;
  const needsReplan = !atPlanned || !feasible(active.journey, now, legIndex);
  return { ...active, walkingOnly: !needsReplan && active.journey.legs.slice(legIndex).length > 0 && active.journey.legs.slice(legIndex).every(l => l.mode === 'foot'), progress: { phase: 'alighted', step: next?.mode === 'foot' ? 'walking' : next ? 'waiting' : 'arrived', legIndex,
    confirmedAt: now, place, locationVerified: true, needsReplan } };
}
export function detectAlighting(active: ActiveJourney, samples: Position[], now: number): AlightingEvidence | null {
  if (active.progress.phase !== 'onboard') return null;
  const leg = active.journey.legs[active.progress.legIndex];
  if (!leg || !isFresh(leg, now)) return null;
  const points = samples.filter(p => p.timestamp >= active.progress.confirmedAt && now - p.timestamp <= 120000 && p.timestamp <= now && p.accuracy <= 35);
  if (points.length < 3 || !usablePosition(points[points.length - 1], now)) return null;
  for (let i = 1; i < points.length; i++) {
    const seconds = (points[i].timestamp - points[i - 1].timestamp) / 1000;
    if (seconds <= 0 || seconds > 45000 / 1000 || distance(points[i].place, points[i - 1].place) / seconds > 40) return null;
  }
  const latest = points[points.length - 1];
  for (const call of leg.calls ?? []) {
    if (!call.alighting || call.position <= (leg.fromPosition ?? -1) || call.cancelled) continue;
    const nearIndex = points.findIndex(p => distance(p.place, call.place) <= 50);
    if (nearIndex < 0) continue;
    const trail = points.slice(nearIndex);
    if (trail.length < 3) continue;
    const first = trail[0];
    const seconds = (latest.timestamp - first.timestamp) / 1000;
    const speed = distance(first.place, latest.place) / seconds;
    const walkingAway = seconds >= 30 && distance(latest.place, call.place) >= 75 && distance(latest.place, call.place) <= 250 && speed >= .5 && speed <= 2.2 &&
      trail.slice(1).every((p, i) => distance(p.place, trail[i].place) / ((p.timestamp - trail[i].timestamp) / 1000) <= 2.5);
    const departure = Date.parse(call.actualDeparture ?? '');
    const stayedBehind = call.realtime && !call.inaccurate && Number.isFinite(departure) && now - departure >= 45000 &&
      latest.timestamp - Math.max(first.timestamp, departure) >= 45000 && trail.every(p => distance(p.place, call.place) <= 50);
    if (walkingAway || stayedBehind) return { key: `${active.startedAt}:${leg.id}:${call.position}`, place: alightingPlace(active, latest), createdAt: now };
  }
  return null;
}
