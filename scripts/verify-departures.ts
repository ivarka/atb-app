import assert from 'node:assert/strict';
import { departures, departureCalls, nearbyStops } from '../src/api/departures';
async function main() {
 const place={id:'NSR:StopPlace:41613',name:'Prinsens gate',latitude:63.431,longitude:10.392};
 const nearby=await nearbyStops(place); assert(nearby.some(p=>p.id===place.id));
 const rows=await departures(place);assert(rows.length,'Ingen avganger i tidsrommet');
 const d=rows.find(d=>!d.cancelled)!;assert(d?.serviceJourneyId && /^\d{4}-\d{2}-\d{2}$/.test(d.serviceDate));
 const calls=await departureCalls(d);assert(calls.some(c=>c.position===d.position));
 const recent=await departures(place,30);assert(recent.length);
 console.log(`Nærliggende holdeplasser: ${nearby.length}. Avganger: ${rows.length}. Historisk vindu: ${recent.length}.`);
 console.log(`Verifisert ${d.mode} ${d.line} mot ${d.headsign}, plattform ${d.place.platform}, driftsdato ${d.serviceDate}, ${calls.length} stopp.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
