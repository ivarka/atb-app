import assert from 'node:assert/strict';
import { entur } from '../src/api/entur';
async function main() {
 const base = { from: { name: 'Lohove', latitude: 63.405, longitude: 10.469 }, to: { name: 'Heimdal', latitude: 63.3508, longitude: 10.3583 }, at: new Date().toISOString() };
 for (const via of [[{ id: 'NSR:StopPlace:41613', name: 'Prinsens gate', latitude: 63.43, longitude: 10.392 }], [{ name: 'Munkegata', latitude: 63.432883, longitude: 10.393742 }, { name: 'Lerkendal', latitude: 63.412, longitude: 10.400 }]]) {
   const routes = await entur.search({ ...base, via });
   assert(routes.length, `Ingen via-reiser: ${via.map(p => p.name).join(', ')}`);
   console.log(via.map(p => p.name).join(' → '), routes.length, routes[0].legs.map(l => `${l.mode}: ${l.from.name} → ${l.to.name}`));
 }
 const walks = await entur.search({ ...base, from: { name: 'Munkegata', latitude: 63.432883, longitude: 10.393742 }, to: { name: 'Trondheim S', latitude: 63.4363, longitude: 10.3992 }, via: [{ name: 'Via', latitude: 63.435, longitude: 10.395 }], walkOnly: true });
 assert(walks.length && walks[0].legs.every(l => l.mode === 'foot'));
 console.log('Gangrute via adresse OK');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
