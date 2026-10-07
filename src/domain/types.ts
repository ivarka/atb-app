export type Preference = 'balanced' | 'fastest' | 'safest';
export type Quality = 'realtime' | 'scheduled' | 'uncertain' | 'stale';
export type Place = { source?: "gps"; id?: string; quayId?: string; platform?: string; name: string; latitude: number; longitude: number };
export type Call = {
  place: Place; position: number; aimedArrival: string; expectedArrival: string;
  aimedDeparture: string; expectedDeparture: string; actualDeparture?: string;
  realtime: boolean; inaccurate: boolean; cancelled: boolean; alighting: boolean;
};
export type TransportMode = 'foot' | 'bus' | 'water' | 'tram' | 'rail';
export type Leg = {
  id: string; mode: TransportMode; from: Place; to: Place;
  aimedStart: string; expectedStart: string; aimedEnd: string; expectedEnd: string;
  duration: number; distance: number; quality: Quality; checkedAt: number; cancelled: boolean;
  line?: string; headsign?: string; serviceJourneyId?: string; serviceDate?: string;
  fromPosition?: number; toPosition?: number; calls?: Call[];
};
export type Journey = { id: string; legs: Leg[]; fetchedAt: number };
export type StepKind = 'walking' | 'waiting' | 'onboard' | 'arrived';
export type Progress = { step?: StepKind; needsReplan?: boolean; locationVerified?: boolean; phase: 'waiting' | 'onboard' | 'alighted'; legIndex: number; place?: Place; confirmedAt: number };
export type PlannedStop = { id: string; place: Place; mode: "direct" | "pause"; visited: boolean };
export type ActiveJourney = { pendingRide?: PendingRide; routeStartIndex?: number; stops?: PlannedStop[]; stay?: { stopId: string; place: Place; continuationFrom?: Place }; walkingOnly?: boolean; journey: Journey; destination: Place; origin: Place; progress: Progress; startedAt: number; demo: boolean; demoBase?: number };
export type Position = { place: Place; timestamp: number; accuracy: number };
export type Transfer = { fromIndex: number; toIndex: number; margin: number; quality: 'known' | 'unknown'; status: 'missed' | 'tight' | 'good' | 'unknown' };
export type TravelAlert = { id: string; kind: 'danger' | 'warning' | 'info'; title: string; detail: string };
export type Recommendation = { journey: Journey; reason: string; progress: Progress };
export type SearchRequest = { stops?: PlannedStop[]; via?: Place[]; from: Place; to: Place; at: string; allowWalkOnly?: boolean; walkOnly?: boolean };
export type ReplanContext = { request: SearchRequest; prefix: Leg[]; progress: Progress };
export interface TravelProvider {
  search(request: SearchRequest): Promise<Journey[]>;
  refresh(journey: Journey, fromIndex: number): Promise<Journey>;
}

export type RecentPlace = { place: Place; usedAt: number };
export type Departure = { id: string; serviceJourneyId: string; serviceDate: string; position: number; place: Place; mode: Exclude<TransportMode, 'foot'>; line: string; headsign: string; aimed: string; expected: string; actual?: string; quality: Quality; cancelled: boolean; boarding: boolean; checkedAt: number };
export type PendingRide = { departure: Departure; nextPosition?: number; nextConfirmedAt?: number; previousExit?: Place };
