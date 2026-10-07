import { Call, Departure, Place } from '../domain/types';
import { DEMO_FROM, DEMO_TO, DEMO_WRONG_STOP } from './provider';
export const DEMO_STATION = { ...DEMO_FROM, name: 'Lohove holdeplass' };
export function demoDepartures(base: number, place: Place): Departure[] {
 return (['bus','bus','tram','rail','water'] as const).map((mode,i) => ({ id: `demo:departure:${i}@${new Date(base).toISOString().slice(0,10)}:1`, serviceJourneyId: `demo:departure:${i}`, serviceDate: new Date(base).toISOString().slice(0,10), position: 1, place: { ...place, platform: `${i+1}` }, mode, line: ['3','3','9','R70','810'][i], headsign: i === 1 ? 'Dragvoll' : 'Sentrum', aimed: new Date(base + (i+2)*60000).toISOString(), expected: new Date(base + (i+3)*60000).toISOString(), quality: 'realtime', cancelled: i === 4, boarding: true, checkedAt: Date.now() }));
}
export function demoDepartureCalls(d: Departure): Call[] {
 return [d.place,DEMO_WRONG_STOP,{ ...DEMO_TO,name:'Pirterminalen' },DEMO_TO].map((place,i) => ({ place, position: i+1, aimedArrival: new Date(Date.parse(d.aimed)+i*300000).toISOString(), expectedArrival: new Date(Date.parse(d.expected)+i*300000).toISOString(), aimedDeparture: new Date(Date.parse(d.aimed)+i*300000).toISOString(), expectedDeparture: new Date(Date.parse(d.expected)+i*300000).toISOString(), realtime: true, inaccurate: false, cancelled: false, alighting: i>0 }));
}
