import { activeRequest, samePlace } from './stops';
import { vehicleName } from './transport';
import { ActiveJourney, Journey, Leg, Position, Preference, Recommendation, ReplanContext, Transfer, TravelAlert } from './types';

export const time = (iso: string) => new Date(iso).getTime();
export const iso = (ms: number) => new Date(ms).toISOString();
export const minutes = (ms: number) => ms / 60000;
export const transitLegs = (j: Journey) => j.legs.filter(l => l.mode !== 'foot');
export const arrival = (j: Journey) => time(j.legs[j.legs.length - 1].expectedEnd);
export const departure = (j: Journey) => time(j.legs[0].expectedStart);
export const journeyKey = (legs: Leg[]) => legs.filter(l => l.mode !== 'foot').map(l => `${l.serviceJourneyId}@${l.serviceDate}:${l.fromPosition}-${l.toPosition}`).join('|') || legs.map(l => `foot:${l.from.latitude},${l.from.longitude}:${l.to.latitude},${l.to.longitude}`).join('|');
export const isFresh = (l: Leg, now: number) => l.quality === 'realtime' && now - l.checkedAt < 90000;

export function transfers(j: Journey, now: number, fromIndex = 0): Transfer[] {
  const indices = j.legs.map((l, i) => l.mode !== 'foot' ? i : -1).filter(i => i >= fromIndex);
  return indices.slice(1).map((toIndex, n) => {
    const fromIndex = indices[n];
    const before = j.legs[fromIndex], after = j.legs[toIndex];
    const walking = j.legs.slice(fromIndex + 1, toIndex).reduce((s, l) => s + l.duration * 1000, 0);
    const margin = minutes(time(after.expectedStart) - time(before.expectedEnd) - walking);
    const known = isFresh(before, now) && isFresh(after, now);
    return { fromIndex, toIndex, margin, quality: known ? 'known' : 'unknown', status: !known ? 'unknown' : margin < 0 ? 'missed' : margin < 3 ? 'tight' : 'good' };
  });
}

/** Walking durations stay fixed; their displayed times follow the updated bus. */
export function alignWalks(j: Journey): Journey {
  const legs = j.legs.map(l => ({ ...l }));
  for (let i = 0; i < legs.length; i++) {
    if (legs[i].mode !== 'foot') continue;
    const prior = legs.slice(0, i).some(l => l.mode !== 'foot');
    if (prior && i > 0) {
      legs[i].expectedStart = legs[i - 1].expectedEnd;
      legs[i].expectedEnd = iso(time(legs[i].expectedStart) + legs[i].duration * 1000);
    }
  }
  return { ...j, legs };
}

export function feasible(j: Journey, now: number, fromIndex = 0, alreadyOnboard = false): boolean {
  const remaining = j.legs.slice(fromIndex);
  if (remaining.some(l => l.cancelled)) return false;
  if (transfers(j, now, fromIndex).some(t => t.margin < 0)) return false;
  const first = remaining.find(l => l.mode !== 'foot');
  if (!alreadyOnboard && first && time(first.expectedStart) < now) return false;
  // Check access walking, not just whether the bus has departed.
  const firstIndex = remaining.findIndex(l => l.mode !== 'foot');
  const walkMs = remaining.slice(0, firstIndex).reduce((s, l) => s + l.duration * 1000, 0);
  return alreadyOnboard || !first || now + walkMs <= time(first.expectedStart) + 1000;
}

function safety(j: Journey, now: number): number {
  const ts = transfers(j, now);
  if (ts.some(t => t.margin < 0)) return 3;
  if (ts.some(t => t.status === 'unknown')) return 2;
  return ts.some(t => t.margin < 5) ? 1 : 0;
}

export function rankJourneys(list: Journey[], preference: Preference, now: number): Journey[] {
  return [...list].sort((a, b) => {
    if (preference === 'safest') return safety(a, now) - safety(b, now) || transitLegs(a).length - transitLegs(b).length || arrival(a) - arrival(b);
    if (preference === 'balanced') return (safety(a, now) === 3 ? 1 : 0) - (safety(b, now) === 3 ? 1 : 0) || arrival(a) - arrival(b);
    return arrival(a) - arrival(b);
  });
}

export function alertsFor(active: ActiveJourney, now: number): TravelAlert[] {
  const { journey, progress } = active;
  const alerts: TravelAlert[] = [];
  if (active.stay || progress.needsReplan || progress.step === 'arrived') return alerts;
  journey.legs.forEach((l, i) => {
    if (i < progress.legIndex || l.mode === 'foot') return;
    if (l.cancelled) alerts.push({ id: `cancel:${l.id}`, kind: 'danger', title: `${vehicleName(l, true)} er innstilt`, detail: 'Se etter en alternativ reise før du fortsetter.' });
    else if (!isFresh(l, now)) alerts.push({ id: `uncertain:${l.id}`, kind: 'info', title: 'Usikker vurdering', detail: `${vehicleName(l, true)}: ${l.quality === 'stale' || now - l.checkedAt >= 90000 ? 'Oppdaterte data er ikke tilgjengelige.' : 'Sanntid mangler eller er usikker.'} Tidene kan endre seg.` });
    else {
      const onboard = progress.phase === 'onboard' && i === progress.legIndex;
      const expected = onboard ? l.expectedEnd : l.expectedStart;
      const aimed = onboard ? l.aimedEnd : l.aimedStart;
      if (time(expected) - time(aimed) >= 120000) alerts.push({
        id: `delay:${onboard ? 'arrival' : 'departure'}:${l.id}`, kind: 'warning',
        title: onboard ? `Forventet ${Math.round(minutes(time(expected) - time(aimed)))} min forsinket til ${l.to.name}` : `${vehicleName(l, true)} fra ${l.from.name} er forsinket`,
        detail: `Forventet ${displayTime(expected)}, rutetid ${displayTime(aimed)}.`,
      });
    }
  });
  for (const t of transfers(journey, now, progress.legIndex)) {
    if (t.status === 'missed' || t.status === 'tight') alerts.push({
      id: `${t.status}:${journey.legs[t.toIndex].id}`, kind: t.status === 'missed' ? 'danger' : 'warning',
      title: t.status === 'missed' ? 'Du ser ikke ut til å rekke overgangen' : 'Knapp overgang',
      detail: `${journey.legs[t.fromIndex].to.name} → ${vehicleName(journey.legs[t.toIndex])}. ${t.margin < 0 ? `Du mangler omtrent ${Math.ceil(-t.margin)} min` : `Bare ${Math.max(0, Math.floor(t.margin))} min til overs`} etter gangtid.`,
    });
  }
  if (progress.phase !== 'onboard') {
    const next = journey.legs.slice(progress.legIndex).find(l => l.mode !== 'foot');
    if (next && time(next.expectedStart) < now && isFresh(next, now)) alerts.push({ id: `departed:${next.id}`, kind: 'warning', title: 'Avgangen kan ha gått', detail: 'Bekreft om du er om bord, eller velg en ny reise.' });
  }
  return alerts;
}

/** Re-plan only from a confirmed reachable location. No inference of boarding from the clock. */
export function replanContext(active: ActiveJourney, now: number, position?: Position): ReplanContext | null {
  const { progress, journey } = active;
  if ((progress.step === 'arrived' && !progress.needsReplan) || (progress.needsReplan && !progress.place)) return null;
  if (progress.phase === 'onboard') {
    const leg = journey.legs[progress.legIndex];
    if (!leg || leg.mode === 'foot' || !isFresh(leg, now)) return null;
    const future = leg.calls?.filter(c => c.alighting && c.realtime && !c.inaccurate && !c.cancelled && !c.actualDeparture && c.position > (leg.fromPosition ?? -1) && time(c.expectedArrival) > now + 30000);
    const nextStop = (active.stops ?? []).find(s => !s.visited);
    const mandatory = nextStop && future?.find(c => samePlace(c.place, nextStop.place));
    const target = mandatory ?? future?.find(c => c.position === leg.toPosition) ?? future?.[0];
    if (!target) return null;
    const clipped = { ...leg, to: target.place, toPosition: target.position, aimedEnd: target.aimedArrival, expectedEnd: target.expectedArrival };
    return { request: activeRequest(active, { from: target.place, to: active.destination, at: iso(time(target.expectedArrival) + 60000) }), prefix: [...journey.legs.slice(0, progress.legIndex), clipped], progress: { ...progress } };
  }
  const freshPosition = position && now - position.timestamp < 60000 && position.accuracy <= 100;
  const from = freshPosition ? position.place : progress.phase === 'alighted' ? progress.place : progress.locationVerified && progress.place ? progress.place : active.origin;
  if (!from) return null;
  const at = Math.max(now, progress.phase === 'waiting' ? departure(journey) : now);
  return { request: activeRequest(active, { from, to: active.destination, at: iso(at) }), prefix: [], progress: { phase: 'waiting', legIndex: 0, confirmedAt: now } };
}

export function recommend(active: ActiveJourney, candidates: Journey[], context: ReplanContext, preference: Preference, now: number): Recommendation | null {
  const remaining = { ...active.journey, legs: active.journey.legs.slice(active.progress.legIndex) };
  if (!remaining.legs.length) return null;
  const valid = candidates.filter(j => feasible(j, Math.max(now, time(context.request.at))));
  const combined = valid.map(j => ({ ...j, legs: [...context.prefix, ...j.legs] })).map(j => ({ ...j, id: journeyKey(j.legs) }));
  // Completed transfers must not affect the ranking of the remaining trip.
  const rankedRemaining = rankJourneys(combined.map(j => ({ ...j, legs: j.legs.slice(context.progress.legIndex) })), preference, now);
  const ranked = rankedRemaining.map(j => combined.find(c => c.id === j.id)!);
  const currentRisk = transfers(remaining, now).some(t => t.status === 'tight' || t.status === 'missed');
  for (const candidate of ranked) {
    if (journeyKey(candidate.legs) === journeyKey(active.journey.legs)) continue;
    const candidateRemaining = { ...candidate, legs: candidate.legs.slice(context.progress.legIndex) };
    const gain = minutes(arrival(active.journey) - arrival(candidate));
    const safer = safety(candidateRemaining, now) < safety(remaining, now);
    const currentBroken = !feasible(remaining, now, 0, active.progress.phase === 'onboard');
    const fewer = transitLegs(candidateRemaining).length < transitLegs(remaining).length;
    let reason = '';
    const walkingRest = candidate.legs.slice(context.prefix.length).every(l => l.mode === 'foot');
    if (currentBroken) reason = walkingRest ? 'Du kan gå resten i stedet' : 'Et gjennomførbart alternativ til reisen din';
    else if (walkingRest && gain >= 1) reason = `Raskere å gå resten · omtrent ${Math.floor(gain)} min tidligere fremme`;
    else if (preference === 'fastest' && gain >= 1) reason = `Omtrent ${Math.floor(gain)} min tidligere fremme`;
    else if (preference === 'balanced' && currentRisk && safer) reason = 'Bedre margin til overgangen';
    else if (preference === 'balanced' && gain >= 5) reason = `Omtrent ${Math.floor(gain)} min tidligere fremme`;
    else if (preference === 'safest' && (safer || (safety(candidateRemaining, now) === safety(remaining, now) && (fewer || (!fewer && transitLegs(candidateRemaining).length === transitLegs(remaining).length && gain >= 1))))) reason = safer ? 'Bedre margin til overgangen' : fewer ? 'Færre bytter' : `Omtrent ${Math.floor(gain)} min tidligere fremme`;
    if (reason) return { journey: candidate, progress: context.progress, reason };
  }
  return null;
}

export const displayTime = (value: string) => new Date(value).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' });
