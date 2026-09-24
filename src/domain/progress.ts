import { vehicleName } from './transport';
import { ActiveJourney, Journey, Progress, StepKind } from './types';
import { displayTime, isFresh, time } from './journey';
export type TravelStep = { kind: StepKind; legIndex: number; label: string; action: string; at?: string };
export function stepsFor(journey: Journey): TravelStep[] {
  const steps: TravelStep[] = [];
  journey.legs.forEach((leg, legIndex) => {
    if (leg.mode === 'foot') steps.push({ kind: 'walking', legIndex, label: `Gå til ${leg.to.name}`, action: `Gå til ${leg.to.name}`, at: leg.expectedEnd });
    else {
      steps.push({ kind: 'waiting', legIndex, label: `Vent på ${vehicleName(leg)}`, action: `Ta ${vehicleName(leg)} fra ${leg.from.name}`, at: leg.expectedStart });
      steps.push({ kind: 'onboard', legIndex, label: `Om bord på ${vehicleName(leg)}`, action: `Gå av på ${leg.to.name}`, at: leg.expectedEnd });
    }
  });
  steps.push({ kind: 'arrived', legIndex: journey.legs.length, label: 'Fremme', action: 'Du er fremme' });
  return steps;
}
export function initialProgress(journey: Journey, now: number): Progress {
  return { phase: 'waiting', legIndex: 0, step: journey.legs[0]?.mode === 'foot' ? 'walking' : 'waiting', confirmedAt: now };
}
export function stepIndex(active: ActiveJourney): number {
  const p = active.progress;
  const kind = p.step ?? (p.phase === 'onboard' ? 'onboard' : active.journey.legs[p.legIndex]?.mode === 'foot' ? 'walking' : 'waiting');
  const steps = stepsFor(active.journey);
  const index = steps.findIndex(s => s.kind === kind && s.legIndex === p.legIndex);
  return index < 0 ? steps.length - 1 : index;
}
export function onboardTiming(active: ActiveJourney, now: number): string | null {
  if (active.progress.phase !== 'onboard') return null;
  const l = active.journey.legs[active.progress.legIndex];
  if (!l || !isFresh(l, now)) return 'Usikker vurdering · oppdatert ankomsttid mangler';
  const delay = Math.round((time(l.expectedEnd) - time(l.aimedEnd)) / 60000);
  return `${l.to.name} ${displayTime(l.expectedEnd)} – ${delay > 0 ? `${delay} min etter rutetid` : delay < 0 ? `${-delay} min før rutetid` : 'i rute'}`;
}
