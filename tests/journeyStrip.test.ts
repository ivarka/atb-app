import { describe,it,expect } from 'vitest';
import { journeyStrip } from '../src/domain/journeyStrip';
import { boardingFixture } from './fixtures/boarding';
const now=Date.now();
describe('grafisk reisefremdrift',()=>{
 it('flytter ikke markøren når klokken går',()=>{const {active}=boardingFixture(now);active.progress.step='waiting';expect(journeyStrip(active,now).points).toEqual(journeyStrip(active,now+999999).points);expect(journeyStrip(active,now).note).toBe('Venter');active.progress.phase='onboard';expect(journeyStrip(active,now).note).toBe('Om bord');});
 it('komprimerer lange reiser til fem punkter og to tider',()=>{const {active}=boardingFixture(now);active.journey.legs=Array.from({length:10},(_,i)=>({...active.journey.legs[0],id:String(i)}));active.progress.legIndex=3;const m=journeyStrip(active,now);expect(m.points).toHaveLength(5);expect(m.points[1].key).toBe('leg:3');expect(m.times.length).toBeLessThanOrEqual(2);});
 it('skjuler fremtidige tider ved ugyldig videreplan',()=>{const {active}=boardingFixture(now);active.progress.needsReplan=true;expect(journeyStrip(active,now).times).toEqual([]);expect(journeyStrip(active,now).note).toBe('Videreplan mangler');});
 it('viser opphold og faktisk ankomst uten å tegne en ferdig videreplan',()=>{const {active}=boardingFixture(now);active.stay={stopId:'pause',place:active.destination};expect(journeyStrip(active,now).times).toEqual([]);expect(journeyStrip(active,now).points.find(p=>p.state==='current')?.label).toBe(active.destination.name);delete active.stay;active.progress.step='arrived';active.progress.legIndex=1;expect(journeyStrip(active,now).points.at(-1)?.state).toBe('current');});
 it('merker tider som usikre når sanntid mangler',()=>{const {active}=boardingFixture(now);active.journey.legs[0].quality='scheduled';expect(journeyStrip(active,now).times.every(t=>t.uncertain)).toBe(true);});
});
