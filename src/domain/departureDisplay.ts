import { Departure } from './types';
export function visibleDepartures(rows: Departure[], now: number, compact: boolean, lookback = 0, limit = 10) {
 const eligible = rows.filter(d => Date.parse(d.expected) >= now-lookback*60000 && (lookback>0 || !d.actual)).sort((a,b)=>Date.parse(a.expected)-Date.parse(b.expected));
 if (compact) {
  const soon = eligible.filter(d=>Date.parse(d.expected)<=now+5*60000);
  return (soon.length ? soon : eligible.slice(0,1)).slice(0,5);
 }
 const ordered = lookback ? [...eligible.filter(d=>Date.parse(d.expected)<=now).reverse(),...eligible.filter(d=>Date.parse(d.expected)>now)] : eligible;
 return ordered.slice(0,limit);
}
