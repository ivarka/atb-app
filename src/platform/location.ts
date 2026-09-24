import { Position } from '../domain/types';
export async function watchPosition(onPosition: (p: Position) => void, onError: (message: string) => void): Promise<() => void> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('Posisjon er ikke tilgjengelig. Bekreft påstigning manuelt.');
  const id = navigator.geolocation.watchPosition(p => onPosition({
    place: { name: 'Min posisjon', latitude: p.coords.latitude, longitude: p.coords.longitude },
    timestamp: p.timestamp, accuracy: p.coords.accuracy,
  }), () => onError('Posisjon mangler. Gi tilgang til posisjon, eller bekreft påstigning manuelt.'),
  { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  return () => navigator.geolocation.clearWatch(id);
}
export async function locate(): Promise<Position> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('Posisjon er ikke tilgjengelig. Søk etter et sted i stedet.');
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(p => resolve({
    place: { name: 'Min posisjon', latitude: p.coords.latitude, longitude: p.coords.longitude }, timestamp: p.timestamp, accuracy: p.coords.accuracy,
  }), () => reject(new Error('Kunne ikke hente posisjonen. Gi nettleseren tilgang, eller velg sted manuelt.')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }));
}
