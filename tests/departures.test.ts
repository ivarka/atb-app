import { describe, expect, it, vi } from 'vitest';
import { candidateExits, confirmedRide, departureLeg, routesWithDeparture, upcomingPosition } from '../src/domain/departures';
import { demoDepartures, demoDepartureCalls, DEMO_STATION } from '../src/demo/departures';
import { DEMO_TO, DEMO_WRONG_STOP, demoProvider } from '../src/demo/provider';
import { newStop } from '../src/domain/stops';
import { Departure, TravelProvider } from '../src/domain/types';
import { normalizeDeparture } from '../src/api/departures';
const now=Date.now();
const d=():Departure=>demoDepartures(now,DEMO_STATION)[0];
describe('konkret påstigning',()=>{
 it('bevarer driftsdato og avgang uavhengig av dagens dato',()=>{ const dep={...d(),serviceDate:'2026-10-06',expected:'2026-10-07T00:15:00+02:00'}; expect(departureLeg(dep).serviceDate).toBe('2026-10-06'); });
 it('skiller mellom avganger med samme linjenummer',()=>{const rows=demoDepartures(now,DEMO_STATION);expect(rows[0].line).toBe(rows[1].line);expect(rows[0].id).not.toBe(rows[1].id);expect(rows[0].headsign).not.toBe(rows[1].headsign);});
 it('lagrer påstigning uten å konstruere en ferdig videreplan',()=>{const a=confirmedRide(d(),DEMO_TO,now,null,true);expect(a.pendingRide?.departure.id).toBe(d().id);expect(a.progress.phase).toBe('onboard');expect(a.progress.needsReplan).toBe(true);});
 it('beholder ubesøkte stopp ved bytte av faktisk transport',()=>{const previous=confirmedRide(d(),DEMO_TO,now,null,true);previous.stops=[newStop(DEMO_WRONG_STOP,'pause')];const a=confirmedRide(demoDepartures(now,DEMO_STATION)[2],DEMO_TO,now,previous,true);expect(a.stops).toEqual(previous.stops);});
 it('utleder ikke faktisk fremdrift fra forventede tider',()=>{const calls=demoDepartureCalls(d()).map(c=>({...c,expectedArrival:new Date(now-60000).toISOString()}));expect(upcomingPosition({departure:d()},calls,now,now)).toBeUndefined();});
 it('krever fersk bekreftelse og lar faktisk passering overstyre eldre neste stopp',()=>{const calls=demoDepartureCalls(d());calls[1].actualDeparture=new Date(now-1000).toISOString();expect(upcomingPosition({departure:d(),nextPosition:2,nextConfirmedAt:now},calls,now,now)).toBe(3);expect(upcomingPosition({departure:d(),nextPosition:2,nextConfirmedAt:now-100000},demoDepartureCalls(d()),now,now)).toBeUndefined();});
 it('velger høyst tre kommende stopp og passerer ikke obligatorisk opphold',()=>{const calls=demoDepartureCalls(d());expect(candidateExits(calls,3,DEMO_TO,[]).every(c=>c.position>=3)).toBe(true);expect(candidateExits(calls,2,DEMO_TO,[newStop(DEMO_WRONG_STOP,'pause')]).map(c=>c.position)).toEqual([2]);});
 it('beholder kjøretøyet i videreforslag og gjør ikke bekreftet påstigning om til venting',async()=>{const dep=d();const routes=await routesWithDeparture(dep,demoDepartureCalls(dep),2,DEMO_TO,[],'balanced',demoProvider(now,'normal'),true);expect(routes.length).toBeGreaterThan(0);expect(routes.every(j=>j.legs[0].serviceJourneyId===dep.serviceJourneyId)).toBe(true);});
 it('lar ikke avbrutte søk fortsette med flere avstigningssteder',async()=>{const provider={search:vi.fn(),refresh:vi.fn()} as TravelProvider;expect(await routesWithDeparture(d(),demoDepartureCalls(d()),2,DEMO_TO,[],'balanced',provider,true,undefined,()=>false)).toEqual([]);expect(provider.search).not.toHaveBeenCalled();});
 it('bevarer ukjent datakvalitet i prefix',()=>{const dep=d(),calls=demoDepartureCalls(dep);calls[1].realtime=false;expect(departureLeg(dep,calls[1],calls).quality).toBe('scheduled');});
 it('normaliserer retning, plattform og kansellering og filtrerer operatører',()=>{
 const raw:any={date:'2026-10-06',stopPositionInPattern:4,aimedDepartureTime:'2026-10-07T00:05:00+02:00',expectedDepartureTime:'2026-10-07T00:07:00+02:00',realtime:true,cancellation:true,forBoarding:true,quay:{id:'q',name:'Stopp',latitude:63,longitude:10,publicCode:'P2',stopPlace:{id:'s'}},destinationDisplay:{frontText:'Sentrum'},serviceJourney:{id:'trip',line:{publicCode:'3',transportMode:'bus',authority:{id:'ATB:Authority:2'}}}};
 expect(normalizeDeparture(raw,now)).toMatchObject({headsign:'Sentrum',serviceDate:'2026-10-06',cancelled:true,place:{platform:'P2'}});
 raw.serviceJourney.line.authority.id='OTHER';expect(normalizeDeparture(raw,now)).toBeNull();
 });
});
