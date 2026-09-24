import { distance } from './boarding';
import { Journey, ReplanContext } from './types';
export const isWalkingJourney = (j: Journey) => j.legs.length > 0 && j.legs.every(l => l.mode === 'foot');
// Bound automatic suggestions; explicit requests are not restricted by this limit.
export const shouldCheckWalking = (context: ReplanContext) => distance(context.request.from, context.request.to) <= 2500;
export const shortWalks = (journeys: Journey[]) => journeys.filter(j => isWalkingJourney(j) && j.legs.reduce((total, l) => total + l.duration, 0) <= 1800);
