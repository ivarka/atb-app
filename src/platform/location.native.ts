import * as Location from 'expo-location';
import { Position } from '../domain/types';
export async function watchPosition(onPosition: (p: Position) => void, onError: (message: string) => void): Promise<() => void> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Gi appen tilgang til posisjon, eller bekreft påstigning manuelt.');
  const subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 }, p => onPosition({
    place: { name: 'Min posisjon', latitude: p.coords.latitude, longitude: p.coords.longitude },
    timestamp: p.timestamp, accuracy: p.coords.accuracy ?? Infinity,
  }), () => onError('Posisjon mangler. Bekreft påstigning manuelt.'));
  return () => subscription.remove();
}
export async function locate(): Promise<Position> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Gi appen tilgang til posisjon, eller velg sted manuelt.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Slå på posisjon på telefonen, eller velg sted manuelt.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const p = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Kunne ikke hente en fersk posisjon. Velg sted manuelt.')), 15000); }),
  ]).finally(() => clearTimeout(timer));
  return { place: { name: 'Min posisjon', latitude: p.coords.latitude, longitude: p.coords.longitude }, timestamp: p.timestamp, accuracy: p.coords.accuracy ?? Infinity };
}
