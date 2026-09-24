import { ActiveJourney, Place, Position } from './types';

export function distance(a: Place, b: Place): number {
  const rad = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * rad;
  const lon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export type BoardingEvidence = { legIndex: number; confidence: 'suggest' | 'automatic' };

// This is a movement heuristic, not vehicle identification. Require a witnessed
// departure and ordered stop matches; never infer boarding from a single fix.
export function detectBoarding(active: ActiveJourney, samples: Position[], now: number): BoardingEvidence | null {
  if (active.progress.phase === 'onboard') return null;
  const legIndex = active.journey.legs.findIndex((l, i) => i >= active.progress.legIndex && l.mode !== 'foot');
  const leg = active.journey.legs[legIndex];
  if (!leg || leg.cancelled || leg.quality !== 'realtime' || now - leg.checkedAt > 90000) return null;
  const points = samples.filter(p => p.accuracy <= 35 && p.accuracy >= 0 &&
    p.timestamp >= active.progress.confirmedAt && now - p.timestamp <= 480000 && p.timestamp <= now &&
    Number.isFinite(p.place.latitude) && Number.isFinite(p.place.longitude));
  if (points.length < 4 || now - points[points.length - 1].timestamp > 20000) return null;
  for (let i = 1; i < points.length; i++) {
    const seconds = (points[i].timestamp - points[i - 1].timestamp) / 1000;
    if (seconds <= 0 || seconds > 45 || distance(points[i - 1].place, points[i].place) / seconds > 40) return null;
  }
  const calls = (leg.calls ?? []).filter(c => c.position >= (leg.fromPosition ?? Infinity) &&
    c.position < (leg.toPosition ?? -Infinity) && c.realtime && !c.inaccurate && !c.cancelled)
    .sort((a, b) => a.position - b.position);
  if (calls[0]?.position !== leg.fromPosition) return null;
  let cursor = 0;
  const matched: Position[] = [];
  for (const call of calls) {
    const arrival = Date.parse(call.expectedArrival);
    const departure = Date.parse(call.actualDeparture ?? call.expectedDeparture);
    const index = points.findIndex((p, i) => i >= cursor && distance(p.place, call.place) <= 55 &&
      p.timestamp >= arrival - 45000 && p.timestamp <= departure + 45000);
    if (index < 0) break;
    matched.push(points[index]); cursor = index + 1;
  }
  if (matched.length < 2) return null;
  const first = matched[0], last = matched[matched.length - 1];
  const elapsed = (last.timestamp - first.timestamp) / 1000;
  const moved = distance(first.place, last.place);
  // Walking past nearby stops is not sufficient evidence of boarding.
  if (elapsed < 30 || moved < 250 || moved / elapsed < 3) return null;
  const latest = points[points.length - 1];
  if (latest.timestamp - last.timestamp > 20000) return null;
  return { legIndex, confidence: leg.mode === 'bus' && matched.length >= 3 && elapsed >= 60 && moved >= 600 ? 'automatic' : 'suggest' };
}
