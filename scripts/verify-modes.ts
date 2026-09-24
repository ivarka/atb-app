import assert from 'node:assert/strict';
import { entur } from '../src/api/entur';
const pairs = [
  { mode: 'tram', from: { name: 'St. Olavs gate', latitude: 63.4297, longitude: 10.3894 }, to: { name: 'Lian', latitude: 63.4018, longitude: 10.3251 } },
  { mode: 'rail', from: { name: 'Trondheim S', latitude: 63.4363, longitude: 10.3992 }, to: { name: 'Stjørdal stasjon', latitude: 63.4685, longitude: 10.9179 } },
  { mode: 'water', from: { name: 'Trondheim hurtigbåtterminal', latitude: 63.4432, longitude: 10.4015 }, to: { name: 'Vanvikan', latitude: 63.5543, longitude: 10.2241 } },
];
async function main() {
  for (const pair of pairs) {
    const journeys = await entur.search({ from: pair.from, to: pair.to, at: new Date().toISOString() });
    const journey = journeys.find(j => j.legs.some(l => l.mode === pair.mode));
    assert(journey, `Ingen ${pair.mode} funnet: ${pair.from.name} → ${pair.to.name}`);
    const refreshed = await entur.refresh(journey, 0);
    assert(refreshed.legs.filter(l => l.mode === pair.mode).every(l => l.calls?.length && l.quality !== 'stale'));
    console.log(`${pair.mode}: ${journey.legs.filter(l => l.mode !== 'foot').map(l => `${l.mode} ${l.line}`).join(' → ')}; oppslag av konkrete avganger OK`);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
