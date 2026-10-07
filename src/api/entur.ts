import { routeRequest } from '../domain/stops';
import { alignWalks, journeyKey } from '../domain/journey';
import { Call, Journey, Leg, Place, SearchRequest, TravelProvider, TransportMode } from '../domain/types';
import { enturRequest, RateLimitError } from './rateLimit';

export const ATB_AUTHORITY = 'ATB:Authority:2';
export const RAIL_AUTHORITY = 'SJN:Authority:SJN';
export function supportedLeg(mode: string, authority?: string): boolean {
  return mode === 'foot' || (['bus', 'water', 'tram'].includes(mode) && authority === ATB_AUTHORITY) || (mode === 'rail' && [ATB_AUTHORITY, RAIL_AUTHORITY].includes(authority ?? ''));
}
const HEADERS = { 'Content-Type': 'application/json', 'ET-Client-Name': 'ika-underveis' };
const ENDPOINT = 'https://api.entur.io/journey-planner/v3/graphql';
const PLACE = 'name latitude longitude quay { id publicCode stopPlace { id } }';
export const CALL = `quay { id name latitude longitude publicCode stopPlace { id } }
  stopPositionInPattern aimedArrivalTime expectedArrivalTime aimedDepartureTime expectedDepartureTime
  actualDepartureTime realtime predictionInaccurate cancellation forAlighting`;
const LEGS = `mode aimedStartTime expectedStartTime aimedEndTime expectedEndTime realtime duration distance serviceDate
  authority { id } fromPlace { ${PLACE} } toPlace { ${PLACE} }
  line { publicCode name } serviceJourney { id }
  fromEstimatedCall { cancellation realtime predictionInaccurate stopPositionInPattern }
  toEstimatedCall { cancellation realtime predictionInaccurate stopPositionInPattern }`;
export const TRIP_QUERY = `query Trip($from: Location!, $to: Location!, $at: DateTime!, $via: [TripViaLocationInput!]) {
  trip(via: $via, from: $from, to: $to, dateTime: $at, numTripPatterns: 8,
    modes: { accessMode: foot, egressMode: foot, transportModes: [{transportMode: bus}, {transportMode: water}, {transportMode: tram}, {transportMode: rail}] },
    whiteListed: { authorities: ["${ATB_AUTHORITY}", "${RAIL_AUTHORITY}"] }) { tripPatterns { legs { ${LEGS} } } }
}`;
export const WALK_QUERY = `query Walk($from: Location!, $to: Location!, $at: DateTime!, $via: [TripViaLocationInput!]) {
  trip(via: $via, from: $from, to: $to, dateTime: $at, numTripPatterns: 1,
    modes: { directMode: foot, transportModes: [] }) { tripPatterns { legs { ${LEGS} } } }
}`;
export const REFRESH_QUERY = `query Refresh($id: String!, $date: Date!) {
  serviceJourney(id: $id) { estimatedCalls(date: $date) { ${CALL} } }
}`;

export async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  try {
    const response = await enturRequest(ENDPOINT, { method: 'POST', headers: HEADERS, body: JSON.stringify({ query, variables }) }, query === TRIP_QUERY || query === WALK_QUERY);
    if (!response.ok) throw new Error(`Entur svarte med feil (${response.status}).`);
    const json = await response.json();
    if (json.errors?.length || !json.data) throw new Error('Kunne ikke hente reisedata fra Entur. Prøv igjen.');
    return json.data as T;
  } catch (e) {
    if (e instanceof Error && (e.name === 'AbortError' || e instanceof TypeError)) throw new Error('Får ikke kontakt med Entur. Sjekk nettet og prøv igjen.');
    throw e;
  }
}

type RawPlace = { name: string; latitude: number; longitude: number; quay?: { id: string; publicCode?: string; stopPlace: { id: string } } };
export type RawCall = { quay: { id: string; name: string; latitude: number; longitude: number; publicCode?: string; stopPlace: { id: string } }; stopPositionInPattern: number; aimedArrivalTime: string; expectedArrivalTime: string; aimedDepartureTime: string; expectedDepartureTime: string; actualDepartureTime?: string; realtime: boolean; predictionInaccurate: boolean; cancellation: boolean; forAlighting: boolean };
type RawLeg = {
  mode: string; aimedStartTime: string; expectedStartTime: string; aimedEndTime: string; expectedEndTime: string;
  realtime: boolean; duration: number; distance: number; serviceDate?: string; authority?: { id: string };
  fromPlace: RawPlace; toPlace: RawPlace; line?: { publicCode: string; name: string }; serviceJourney?: { id: string };
  fromEstimatedCall?: Pick<RawCall, 'cancellation' | 'realtime' | 'predictionInaccurate' | 'stopPositionInPattern'>;
  toEstimatedCall?: Pick<RawCall, 'cancellation' | 'realtime' | 'predictionInaccurate' | 'stopPositionInPattern'>;
};
const place = (p: RawPlace): Place => ({ name: p.name, latitude: p.latitude, longitude: p.longitude, id: p.quay?.stopPlace.id, quayId: p.quay?.id, platform: p.quay?.publicCode });
const location = (p: Place) => p.quayId || p.id?.startsWith('NSR:StopPlace:') ? { place: p.quayId ?? p.id, name: p.name } : { name: p.name, coordinates: { latitude: p.latitude, longitude: p.longitude } };

export function normalize(raw: RawLeg[], now: number): Journey {
  const legs: Leg[] = raw.map((l, i) => ({
    id: l.serviceJourney ? `${l.serviceJourney.id}@${l.serviceDate}:${l.fromEstimatedCall?.stopPositionInPattern}-${l.toEstimatedCall?.stopPositionInPattern}` : `walk-${i}`,
    mode: l.mode as TransportMode, from: place(l.fromPlace), to: place(l.toPlace),
    aimedStart: l.aimedStartTime, expectedStart: l.expectedStartTime, aimedEnd: l.aimedEndTime, expectedEnd: l.expectedEndTime,
    duration: l.duration, distance: l.distance, cancelled: !!(l.fromEstimatedCall?.cancellation || l.toEstimatedCall?.cancellation),
    quality: l.fromEstimatedCall?.predictionInaccurate || l.toEstimatedCall?.predictionInaccurate ? 'uncertain' : l.realtime && l.fromEstimatedCall?.realtime && l.toEstimatedCall?.realtime ? 'realtime' : 'scheduled',
    checkedAt: now, line: l.line?.publicCode, headsign: l.line?.name, serviceJourneyId: l.serviceJourney?.id,
    serviceDate: l.serviceDate, fromPosition: l.fromEstimatedCall?.stopPositionInPattern, toPosition: l.toEstimatedCall?.stopPositionInPattern,
  }));
  return { id: journeyKey(legs), legs, fetchedAt: now };
}

export function normalizeCall(c: RawCall): Call {
  return { place: { id: c.quay.stopPlace.id, quayId: c.quay.id, name: c.quay.name, latitude: c.quay.latitude, longitude: c.quay.longitude, platform: c.quay.publicCode }, position: c.stopPositionInPattern,
    aimedArrival: c.aimedArrivalTime, expectedArrival: c.expectedArrivalTime, aimedDeparture: c.aimedDepartureTime, expectedDeparture: c.expectedDepartureTime,
    actualDeparture: c.actualDepartureTime, realtime: c.realtime, inaccurate: c.predictionInaccurate, cancelled: c.cancellation, alighting: c.forAlighting };
}

export function updateLeg(l: Leg, calls: Call[], now: number): Leg {
  // Pattern position is stable when a platform changes and distinguishes repeated visits to a stop.
  const from = calls.find(c => c.position === l.fromPosition);
  const to = calls.find(c => c.position === l.toPosition);
  if (!from || !to) return { ...l, quality: 'stale', calls };
  return { ...l, from: from.place, to: to.place, aimedStart: from.aimedDeparture, expectedStart: from.expectedDeparture, aimedEnd: to.aimedArrival, expectedEnd: to.expectedArrival,
    quality: from.inaccurate || to.inaccurate ? 'uncertain' : from.realtime && to.realtime ? 'realtime' : 'scheduled',
    cancelled: from.cancelled || to.cancelled, checkedAt: now, calls };
}

export const entur: TravelProvider = {
  async search(input: SearchRequest) {
    const request = input.stops ? routeRequest(input) : input;
    // Pure walking is routed in ordered sections: passThrough requires a transit vehicle.
    if (request.walkOnly && request.via?.length) {
      const legs: Leg[] = []; let from = request.from, at = request.at;
      for (const to of [...request.via, request.to]) {
        const routes = await entur.search({ from, to, at, walkOnly: true });
        if (!routes.length) return [];
        legs.push(...routes[0].legs); from = to; at = legs.at(-1)!.expectedEnd;
      }
      return [{ id: journeyKey(legs), legs, fetchedAt: Date.now() }];
    }
    const data = await graphql<{ trip: { tripPatterns: { legs: RawLeg[] }[] } }>(request.walkOnly ? WALK_QUERY : TRIP_QUERY, { from: location(request.from), to: location(request.to), at: request.at, via: (request.via ?? []).map(p => p.quayId || p.id?.startsWith("NSR:StopPlace:") ? { passThrough: { label: p.name, stopLocationIds: [p.id?.startsWith("NSR:StopPlace:") ? p.id : p.quayId] } } : { visit: { label: p.name, coordinate: { latitude: p.latitude, longitude: p.longitude } } }) });
    const now = Date.now();
    return data.trip.tripPatterns.filter(p => p.legs.length > 0 && (request.walkOnly || request.allowWalkOnly || p.legs.some(l => l.mode !== 'foot')) && (!request.walkOnly || p.legs.every(l => l.mode === 'foot')) && p.legs.every(l => supportedLeg(l.mode, l.authority?.id)))
      .map(p => normalize(p.legs, now));
  },
  async refresh(journey, fromIndex) {
    // One request per dated service journey; shared calls cover all stops, including later alighting options.
    const requests = new Map<string, Promise<Call[]>>();
    for (const l of journey.legs.slice(fromIndex)) {
      if (l.mode === 'foot' || !l.serviceJourneyId || !l.serviceDate) continue;
      const key = `${l.serviceJourneyId}@${l.serviceDate}`;
      if (!requests.has(key)) requests.set(key, graphql<{ serviceJourney: { estimatedCalls: RawCall[] } | null }>(REFRESH_QUERY, { id: l.serviceJourneyId, date: l.serviceDate }).then(d => (d.serviceJourney?.estimatedCalls ?? []).map(normalizeCall)));
    }
    const results = await Promise.allSettled([...requests.values()]);
    const limited = results.find(r => r.status === 'rejected' && r.reason instanceof RateLimitError);
    if (limited?.status === 'rejected') throw limited.reason;
    const values = new Map([...requests.keys()].map((key, i) => [key, results[i]]));
    const now = Date.now();
    const legs = journey.legs.map((l, i) => {
      if (l.mode === 'foot' || i < fromIndex) return l;
      const result = values.get(`${l.serviceJourneyId}@${l.serviceDate}`);
      return result?.status === 'fulfilled' ? updateLeg(l, result.value, now) : { ...l, quality: 'stale' as const };
    });
    return alignWalks({ ...journey, legs, fetchedAt: now });
  },
};

export async function autocomplete(text: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ text, size: '10', lang: 'no', 'focus.point.lat': '63.4305', 'focus.point.lon': '10.3951' });
  const response = await enturRequest(`https://api.entur.io/geocoder/v1/autocomplete?${params}`, { headers: { 'ET-Client-Name': HEADERS['ET-Client-Name'] }, signal });
  if (!response.ok) throw new Error('Stedssøket er utilgjengelig. Prøv igjen.');
  const data = await response.json();
  return data.features.filter((f: { properties: { county?: string } }) => f.properties.county === 'Trøndelag')
    .map((f: { geometry: { coordinates: number[] }; properties: { id: string; label: string; name: string } }) => ({ id: f.properties.id, name: f.properties.label ?? f.properties.name, latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] }));
}

export const EXAMPLE_FROM: Place = { name: 'Munkegata, Trondheim', latitude: 63.432883, longitude: 10.393742, id: 'NSR:StopPlace:63277' };
export const EXAMPLE_TO: Place = { name: 'Lerkendal, Trondheim', latitude: 63.412, longitude: 10.400, id: 'NSR:StopPlace:60257' };

/** A display label only: retain GPS coordinates and never snap routing to a stop. */
export async function namePosition(place: Place, signal?: AbortSignal): Promise<Place> {
  const fallback: Place = { source: 'gps', name: `Posisjon (${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)})`, latitude: place.latitude, longitude: place.longitude };
  try {
    const params = new URLSearchParams({ 'point.lat': String(place.latitude), 'point.lon': String(place.longitude), size: '1', lang: 'no' });
    const response = await enturRequest(`https://api.entur.io/geocoder/v1/reverse?${params}`, { headers: { 'ET-Client-Name': HEADERS['ET-Client-Name'] }, signal });
    if (!response.ok) return fallback;
    const data = await response.json();
    const p = data.features?.[0]?.properties;
    const label = p?.label ?? p?.name;
    return typeof label === 'string' && Number.isFinite(p.distance) && p.distance <= .15 ? { ...fallback, name: `Ved ${label}` } : fallback;
  } catch { return fallback; }
}
