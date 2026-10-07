import { useEffect, useRef, useState } from 'react';
import { departures } from '../api/departures';
import { Departure, Place } from '../domain/types';
import { demoDepartures } from '../demo/departures';
import { isForeground, onVisibilityChange } from '../platform/visibility';
export function useDepartures(place: Place | undefined, lookback: number, demo: boolean, enabled: boolean) {
 const [rows,setRows] = useState<Departure[]>([]), [error,setError] = useState(''), [busy,setBusy] = useState(false);
 const [foreground,setForeground] = useState(isForeground), [tick,setTick] = useState(0);
 const base = useRef(Date.now());
 useEffect(() => onVisibilityChange(() => setForeground(isForeground())), []);
 useEffect(() => { setRows([]); setError(''); },[place?.id,lookback,demo]);
 useEffect(() => {
  if (!place || !enabled || !foreground) { setBusy(false); return; }
  let disposed = false, running = false;
  const run = async () => {
   if (running) return; running = true; setBusy(true);
   try { const result = demo ? demoDepartures(base.current,place) : await departures(place,lookback); if (!disposed) { setRows(result); setError(''); } }
   catch(e) { if (!disposed) setError(e instanceof Error ? e.message : 'Kunne ikke hente avganger.'); }
   finally { running = false; if (!disposed) setBusy(false); }
  };
  void run(); const timer = setInterval(() => void run(),30000);
  return () => { disposed = true; clearInterval(timer); };
 },[place?.id,lookback,demo,enabled,foreground,tick]);
 return { rows, error, busy, paused: !foreground || !enabled, refresh: () => setTick(t => t+1) };
}
