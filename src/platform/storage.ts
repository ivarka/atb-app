import { ActiveJourney, Preference } from '../domain/types';
const KEY = 'underveis.v1';
type Saved = { version: 1; active: ActiveJourney | null; preference: Preference };
export function loadSaved(): Saved | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (data?.version !== 1 || !['balanced', 'fastest', 'safest'].includes(data.preference)) return null;
    if (data.active && (!Array.isArray(data.active.journey?.legs) || !data.active.journey.legs.length || !data.active.progress || !data.active.destination || !Number.isFinite(data.active.startedAt))) return null;
    if (data.active && !data.active.progress.step) {
      const a = data.active as ActiveJourney;
      const p = a.progress;
      p.step = p.phase === 'onboard' ? 'onboard' : a.journey.legs[p.legIndex]?.mode === 'foot' ? 'walking' : 'waiting';
      if (p.phase === 'alighted') { p.place = undefined; p.locationVerified = false; p.needsReplan = true; }
    }
    if (data.active) data.active.stops ??= [];
    return data;
  } catch { return null; }
}
export function saveState(active: ActiveJourney | null, preference: Preference) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify({ version: 1, active, preference })); } catch { /* Private mode / full storage: keep in-memory session usable. */ }
}
