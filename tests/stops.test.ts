import { describe, expect, it } from 'vitest';
import { activeRequest, markStop, newStop, observedStops, routeRequest } from '../src/domain/stops';
import { demoJourneys, demoProvider, DEMO_FROM, DEMO_TO, DEMO_WRONG_STOP } from '../src/demo/provider';
import { ActiveJourney } from '../src/domain/types';
import { alertsFor, replanContext } from '../src/domain/journey';
const now = Date.now();
const direct = newStop(DEMO_WRONG_STOP);
const pause = newStop(DEMO_TO, 'pause');
const later = newStop(DEMO_FROM);
const base = (): ActiveJourney => ({ journey: demoJourneys(now)[0], origin: DEMO_FROM, destination: DEMO_TO, progress: { phase: 'waiting', step: 'walking', legIndex: 0, confirmedAt: now }, startedAt: now, demo: true, stops: [direct, pause, later] });
describe('planlagte stopp', () => {
 it('planlegger bare frem til første opphold og beholder rekkefølge', () => {
   const a = base(); const r = activeRequest(a, { from: a.origin, to: a.destination, at: new Date(now).toISOString() });
   expect(r.to).toEqual(pause.place); expect(r.via).toEqual([direct.place]); expect(a.stops).toHaveLength(3);
 });
 it('utelater besøkte stopp, men beholder neste stopp', () => {
   const a = markStop(base(), direct.id); expect(routeRequest({ from: a.origin, to: a.destination, at: '', stops: a.stops }).via).toEqual([]);
 });
 it('hopper ikke over tidligere stopp ved bekreftelse', () => { expect(markStop(base(), pause.id).stay).toBeUndefined(); });
 it('besøkt opphold bevares uten aktive varsler', () => {
   const a = markStop(markStop(base(), direct.id), pause.id);
   expect(a.stay?.stopId).toBe(pause.id); expect(a.stops?.[2].visited).toBe(false); expect(alertsFor(a, now)).toEqual([]);
 });
 it('videreføring bruker faktisk sted og utestående stopp', () => {
   const a = markStop(markStop(base(), direct.id), pause.id);
   const r = activeRequest(a, { from: DEMO_WRONG_STOP, to: a.destination, at: new Date(now).toISOString() });
   expect(r.from).toEqual(DEMO_WRONG_STOP); expect(r.via).toEqual([later.place]); expect(r.to).toEqual(DEMO_TO);
 });
 it('klokken og forventet passering markerer aldri besøkt', () => {
   const a = base(); a.stops = [newStop(a.journey.legs[1].to)]; a.progress = { ...a.progress, phase: 'onboard', step: 'onboard', legIndex: 1 };
   expect(observedStops(a, now + 3600000).stops?.[0].visited).toBe(false);
 });
 it('fersk faktisk avgang på bekreftet kjøretøy markerer passering', () => {
   const a = base(); a.stops = [newStop(a.journey.legs[1].to)]; a.progress = { ...a.progress, phase: 'onboard', step: 'onboard', legIndex: 1 };
   a.journey.legs[1].calls![1].actualDeparture = new Date(now - 1000).toISOString();
   expect(observedStops(a, now).stops?.[0].visited).toBe(true);
   expect(observedStops(a, now + 100000).stops?.[0].visited).toBe(false);
 });
 it('omplanlegging og gangforespørsler beholder stopp', () => {
   const r = replanContext(base(), now)!.request; expect(r.via).toEqual([direct.place]); expect(r.to).toEqual(pause.place);
 });
 it('demo via flere stopp beholder samme buss', async () => {
   const r = await demoProvider(now, 'normal').search({ from: DEMO_FROM, to: DEMO_TO, at: new Date(now).toISOString(), stops: [direct, later] });
   expect(r[0].legs).toHaveLength(1); expect(r[0].legs[0].calls?.map(c => c.place)).toEqual([DEMO_FROM, direct.place, later.place, DEMO_TO]);
 });
 it('gangrute besøker alle stopp i rekkefølge', async () => {
   const r = await demoProvider(now, 'normal').search({ from: DEMO_FROM, to: DEMO_TO, at: new Date(now).toISOString(), stops: [direct, later], walkOnly: true });
   expect(r[0].legs.map(l => l.to)).toEqual([direct.place, later.place, DEMO_TO]); expect(r[0].legs.every(l => l.mode === 'foot')).toBe(true);
 });
});
it('adressebesøk blir ikke automatisk godkjent fra en passerende buss', () => {
 const a = base(); const to = a.journey.legs[1].to;
 a.stops = [newStop({ ...to, id: 'address:1', quayId: undefined })];
 a.progress = { ...a.progress, phase: 'onboard', step: 'onboard', legIndex: 1 };
 a.journey.legs[1].calls![1].actualDeparture = new Date(now - 1000).toISOString();
 expect(observedStops(a, now).stops?.[0].visited).toBe(false);
});
it('bekreftet adressebesøk flytter fremdrift til neste gangetappe', () => {
 const a = base(); a.stops = [newStop(a.journey.legs[0].to)];
 const updated = markStop(a, a.stops[0].id);
 expect(updated.progress.legIndex).toBe(1); expect(updated.progress.step).toBe('waiting');
});
it('nytt stopp etter ruteendring oppfylles ikke av gammel reisehistorikk', () => {
 const a = base(); a.stops = [newStop(a.journey.legs[1].to)];
 a.progress = { ...a.progress, legIndex: 3, phase: 'onboard', step: 'onboard' }; a.routeStartIndex = 3;
 expect(observedStops(a, now).stops?.[0].visited).toBe(false);
});
