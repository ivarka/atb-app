import { CALL, graphql, normalizeCall, RawCall, supportedLeg } from './entur';
import { Call, Departure, Place } from '../domain/types';
import { distance } from '../domain/boarding';
export const DEPARTURES_QUERY = `query Departures($id: String!, $start: DateTime!, $range: Int!) {
 stopPlace(id:$id) { estimatedCalls(startTime:$start,timeRange:$range,numberOfDepartures:100,numberOfDeparturesPerLineAndDestinationDisplay:20,includeCancelledTrips:true) {
 date stopPositionInPattern aimedDepartureTime expectedDepartureTime actualDepartureTime realtime predictionInaccurate cancellation forBoarding
 destinationDisplay { frontText } quay { id name latitude longitude publicCode stopPlace { id name } }
 serviceJourney { id line { publicCode transportMode authority { id } } }
 } }
}`;
export type RawDeparture = RawCall & { date: string; forBoarding: boolean; destinationDisplay?: { frontText: string }; serviceJourney: { id: string; line: { publicCode: string; transportMode: string; authority: { id: string } } } };
export function normalizeDeparture(c: RawDeparture, now: number): Departure | null {
 const line = c.serviceJourney.line;
 if (line.transportMode === 'foot' || !supportedLeg(line.transportMode, line.authority?.id)) return null;
 return { id: `${c.serviceJourney.id}@${c.date}:${c.stopPositionInPattern}`, serviceJourneyId: c.serviceJourney.id, serviceDate: c.date, position: c.stopPositionInPattern,
 place: normalizeCall(c).place, mode: line.transportMode as Departure['mode'], line: line.publicCode, headsign: c.destinationDisplay?.frontText ?? '',
 aimed: c.aimedDepartureTime, expected: c.expectedDepartureTime, actual: c.actualDepartureTime,
 quality: c.predictionInaccurate ? 'uncertain' : c.realtime ? 'realtime' : 'scheduled', cancelled: c.cancellation, boarding: c.forBoarding, checkedAt: now };
}
const cache = new Map<string, { at: number; promise: Promise<Departure[]> }>();
export async function departures(place: Place, lookback = 0): Promise<Departure[]> {
 if (!place.id?.startsWith('NSR:StopPlace:')) throw new Error('Velg en holdeplass fra forslagene.');
 const key = `${place.id}:${lookback}`, now = Date.now(), existing = cache.get(key);
 if (existing && now - existing.at < 30000) return existing.promise;
 const promise = graphql<{ stopPlace: { estimatedCalls: RawDeparture[] } | null }>(DEPARTURES_QUERY, { id: place.id, start: new Date(now - lookback * 60000).toISOString(), range: 3600 + lookback * 60 }).then(data => {
  if (!data.stopPlace) throw new Error('Holdeplassen finnes ikke lenger. Velg en annen.');
  return data.stopPlace.estimatedCalls.map(c => normalizeDeparture(c, Date.now())).filter((d): d is Departure => !!d && d.boarding)
   .filter(d => Date.parse(d.expected) >= now - lookback * 60000 && Date.parse(d.expected) <= now + 3600000)
   .sort((a, b) => Date.parse(a.expected) - Date.parse(b.expected));
 });
 cache.set(key, { at: now, promise });
 if (cache.size > 30) cache.delete(cache.keys().next().value!);
 return promise;
}
export async function departureCalls(d: Departure): Promise<Call[]> {
 const data = await graphql<{ serviceJourney: { estimatedCalls: RawCall[] } | null }>(`query DepartureCalls($id:String!,$date:Date!){serviceJourney(id:$id){estimatedCalls(date:$date){${CALL}}}}`, { id: d.serviceJourneyId, date: d.serviceDate });
 const calls = (data.serviceJourney?.estimatedCalls ?? []).map(normalizeCall);
 if (!calls.length) throw new Error('Stoppfølgen kunne ikke hentes. Avgangen du har bekreftet er beholdt.');
 return calls;
}
export async function nearbyStops(place: Place): Promise<Place[]> {
 const data = await graphql<{ quaysByRadius: { edges: { node: { quay: { stopPlace: Place } } }[] } }>(`query NearbyStops($lat:Float!,$lon:Float!){quaysByRadius(latitude:$lat,longitude:$lon,radius:800,first:50){edges{node{quay{stopPlace{id name latitude longitude}}}}}}`, { lat: place.latitude, lon: place.longitude });
 return [...new Map(data.quaysByRadius.edges.map(e => [e.node.quay.stopPlace.id, e.node.quay.stopPlace])).values()].sort((a,b) => distance(a,place)-distance(b,place)).slice(0,8);
}
