import { useEffect, useState } from 'react';
import { Place, RecentPlace } from '../domain/types';
const KEY = 'underveis.recent-places.v1';
const listeners = new Set<() => void>();
export const placeKey = (p: Place) => p.id ?? `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
export function loadRecentPlaces(): RecentPlace[] {
  try { const data = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(data) ? data.filter(p => p?.place?.name && Number.isFinite(p.place.latitude) && Number.isFinite(p.place.longitude)).slice(0, 10) : []; } catch { return []; }
}
function save(list: RecentPlace[]) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* Storage may be unavailable. */ } listeners.forEach(fn => fn()); }
export function rememberPlaces(places: Place[]) {
  const unique = new Map<string, RecentPlace>();
  for (const place of places) if (place.source !== 'gps' && !place.id?.startsWith('demo:')) unique.set(placeKey(place), { place, usedAt: Date.now() });
  for (const item of loadRecentPlaces()) if (!unique.has(placeKey(item.place))) unique.set(placeKey(item.place), item);
  save([...unique.values()].slice(0, 10));
}
export function removeRecentPlace(p: Place) { save(loadRecentPlaces().filter(r => placeKey(r.place) !== placeKey(p))); }
export function clearRecentPlaces() { save([]); }
export function useRecentPlaces() {
  const [places, setPlaces] = useState(loadRecentPlaces);
  useEffect(() => { const update = () => setPlaces(loadRecentPlaces()); listeners.add(update); return () => { listeners.delete(update); }; }, []);
  return places;
}
