import assert from 'node:assert/strict';
import { ATB_AUTHORITY, autocomplete, entur, graphql } from '../src/api/entur';
import { iso } from '../src/domain/journey';

async function main() {
const data = await graphql<{ authorities: { id: string; name: string }[] }>('{ authorities { id name } }');
assert(data.authorities.some(a => a.id === ATB_AUTHORITY && a.name === 'AtB'));
const places = await autocomplete('Munkegata');
assert(places.some(p => p.name.includes('Trondheim')));
const pairs = [
  { from: { name: 'Munkegata', latitude: 63.432883, longitude: 10.393742 }, to: { name: 'Lerkendal', latitude: 63.412, longitude: 10.400 } },
  { from: { name: 'Lohove', latitude: 63.405, longitude: 10.469 }, to: { name: 'Heimdal', latitude: 63.3508, longitude: 10.3583 } },
];
let direct = false, transfer = false;
for (const pair of pairs) {
  const journeys = await entur.search({ ...pair, at: iso(Date.now()) });
  assert(journeys.length, `Ingen reiser for ${pair.from.name} → ${pair.to.name}`);
  for (const j of journeys) {
    const buses = j.legs.filter(l => l.mode === 'bus');
    direct ||= buses.length === 1; transfer ||= buses.length > 1;
    assert(buses.every(l => l.serviceJourneyId?.startsWith('ATB:') && l.serviceDate));
  }
  const refreshed = await entur.refresh(journeys[0], 0);
  assert.equal(refreshed.id, journeys[0].id);
  assert(refreshed.legs.filter(l => l.mode === 'bus').every(l => l.calls?.length && l.quality !== 'stale'));
  console.log(`${pair.from.name} → ${pair.to.name}: ${journeys.length} reiseforslag, oppdatering OK`);
}
assert(direct, 'Mangler direkte bussreise'); assert(transfer, 'Mangler reise med overgang');
console.log('AtB-identifikator, geokoding, direkte buss, overgang og sanntidsoppslag er verifisert.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
