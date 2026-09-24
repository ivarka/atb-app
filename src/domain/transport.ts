import { Leg, TransportMode } from './types';
export const transport = {
  foot: { name: 'gange', title: 'Gange', icon: '🚶' },
  bus: { name: 'buss', title: 'Buss', icon: '🚌' },
  water: { name: 'båt', title: 'Båt', icon: '⛴' },
  tram: { name: 'trikk', title: 'Trikk', icon: '🚋' },
  rail: { name: 'tog', title: 'Tog', icon: '🚆' },
} satisfies Record<TransportMode, { name: string; title: string; icon: string }>;
export const isTransit = (leg: Pick<Leg, 'mode'>) => leg.mode !== 'foot';
export const vehicleName = (leg: Pick<Leg, 'mode' | 'line'>, capital = false) => `${capital ? transport[leg.mode].title : transport[leg.mode].name}${leg.line ? ` ${leg.line}` : ''}`;
