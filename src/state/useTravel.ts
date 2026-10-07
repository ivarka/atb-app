import { departureCalls } from '../api/departures';
import { demoDepartureCalls } from '../demo/departures';
import { confirmedRide, departureLeg, routesWithDeparture, upcomingPosition } from '../domain/departures';
import { rememberPlaces } from '../platform/recentPlaces';
import { activeRequest, routeRequest, markStop, nextPause, observedStops, samePlace, isTransitStop } from '../domain/stops';
import { useCallback, useEffect, useRef, useState } from 'react';
import { entur, namePosition } from '../api/entur';
import { demoProvider, Scenario } from '../demo/provider';
import { alertsFor, feasible, rankJourneys, recommend, replanContext, transfers } from '../domain/journey';
import { ActiveJourney, Journey, Position, Preference, Recommendation, SearchRequest } from '../domain/types';
import { loadSaved, saveState } from '../platform/storage';
import { isForeground, onVisibilityChange } from '../platform/visibility';
import { locate, watchPosition } from '../platform/location';
import { BoardingEvidence, detectBoarding, distance } from '../domain/boarding';
import { Place, Progress, PlannedStop, Departure } from '../domain/types';
import { isWalkingJourney, shouldCheckWalking, shortWalks } from '../domain/walking';
import { initialProgress } from '../domain/progress';
import { afterAlighting, alightingPlace, AlightingEvidence, detectAlighting, usablePosition } from '../domain/alighting';

export function useTravel() {
  const [saved] = useState(loadSaved);
  const [active, setActive] = useState<ActiveJourney | null>(saved?.active ?? null);
  const [preference, setPreference] = useState<Preference>(saved?.preference ?? 'balanced');
  const [demo, setDemo] = useState(saved?.active?.demo ?? false);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [results, setResults] = useState<Journey[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [ready, setReady] = useState(!saved?.active);
  const [paused, setPaused] = useState(false);
  const [resumed, setResumed] = useState(!!saved?.active);
  const [now, setNow] = useState(Date.now());
  const [position, setPosition] = useState<Position>();
  const positionRef = useRef<Position | undefined>(undefined);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [gpsStatus, setGpsStatus] = useState('Venter på posisjon …');
  const [boarding, setBoarding] = useState<BoardingEvidence | null>(null);
  const [boardingUndo, setBoardingUndo] = useState<Progress | null>(null);
  const dismissedBoarding = useRef('');
  const [alighting, setAlighting] = useState<AlightingEvidence | null>(null);
  const dismissedAlighting = useRef(new Set<string>());
  const [choosingAlight, setChoosingAlight] = useState(false);
  const [locatingAlight, setLocatingAlight] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [walkingChoice, setWalkingChoice] = useState<Journey | null>(null);
  const [walkingBusy, setWalkingBusy] = useState(false);
  const walkRequest = useRef(0);
  const [stopChoices, setStopChoices] = useState<{ journey: Journey; active: ActiveJourney }[]>([]);
  const [stopBusy, setStopBusy] = useState(false);
  const [resumePlace, setResumePlace] = useState(false);
  const stopRequest = useRef(0);
  const [rideChoices, setRideChoices] = useState<Journey[]>([]);
  const [recovery, setRecovery] = useState<Journey[]>([]);

  const [demoBase, setDemoBase] = useState(saved?.active?.demoBase ?? Date.now());
  const current = useRef(active);
  const generation = useRef(0);
  const searchId = useRef(0);
  const inFlight = useRef<number | null>(null);
  const lastAlternatives = useRef(0);
  const currentRisk = useRef('');
  current.current = active;

  const mutate = (next: ActiveJourney | null) => {
    setRideChoices([]);
    generation.current++; walkRequest.current++; stopRequest.current++; setStopChoices([]); setStopBusy(false); setResumePlace(false); setWalkingBusy(false); setWalkingChoice(null);
    if (next) {
      next = observedStops(next, Date.now());
      const pause = nextPause(next);
      if (!next.stay && pause && next.progress.step === 'arrived' && !next.progress.needsReplan && !(next.stops ?? []).some(s => !s.visited && s.id !== pause.id && (next!.stops ?? []).indexOf(s) < (next!.stops ?? []).indexOf(pause))) next = markStop(next, pause.id);
    }
    current.current = next;
    setActive(next);
    setRecommendation(null);
    lastAlternatives.current = 0;
    currentRisk.current = '';
    setReady(!next || (next.progress.step === 'arrived' && !next.progress.needsReplan));
    setError('');
    setBoarding(null);
    setBoardingUndo(null);
    setAlighting(null); setRecovery([]); setChoosingAlight(false); setLocatingAlight(false);
  };

  const cycle = useCallback(async (force = false) => {
    const snapshot = current.current;
    if (!snapshot || !isForeground()) return;
    if (snapshot.stay) { setReady(true); setBusy(false); return; }
    if (snapshot.progress.step === 'arrived' && !snapshot.progress.needsReplan) { setReady(true); return; }
    const token = generation.current;
    if (inFlight.current === token) return;
    inFlight.current = token;
    setBusy(true);
    const provider = snapshot.demo ? demoProvider(snapshot.demoBase ?? demoBase, scenario) : entur;
    try {
      if (snapshot.pendingRide) {
        const ride = snapshot.pendingRide;
        const calls = snapshot.demo ? demoDepartureCalls(ride.departure) : await departureCalls(ride.departure);
        if (generation.current !== token) return;
        const checkedAt = Date.now();
        const updated = { ...snapshot, journey: { ...snapshot.journey, fetchedAt: checkedAt, legs: [departureLeg({ ...ride.departure, checkedAt }, calls.at(-1), calls)] } };
        current.current = updated; setActive(updated); setReady(true); setError('');
        const next = upcomingPosition(ride,calls,checkedAt,checkedAt,positionRef.current);
        if (next === undefined) { setRideChoices([]); return; }
        if (force || checkedAt-lastAlternatives.current>=60000) {
          lastAlternatives.current = checkedAt;
          const options = await routesWithDeparture({ ...ride.departure, checkedAt },calls,next,snapshot.destination,snapshot.stops ?? [],preference,provider,true,ride.previousExit,() => generation.current===token && isForeground());
          if (generation.current !== token) return;
          setRideChoices(options);
          if (!options.length) setError('Ingen videre reiser funnet. Avgangen du sitter på er beholdt. Prøv igjen.');
        }
        return;
      }
      if (snapshot.walkingOnly) {
        setReady(true);
        if (!force && Date.now() - lastAlternatives.current < 60000) return;
        lastAlternatives.current = Date.now();
        const p = positionRef.current;
        if (!usablePosition(p, Date.now()) || snapshot.demo) return;
        if (isWalkingJourney(snapshot.journey) && Date.now() - snapshot.journey.fetchedAt < 60000 && distance(p.place, snapshot.origin) < 25) return;
        const routes = await provider.search(activeRequest(snapshot, { from: p.place, to: snapshot.destination, at: new Date().toISOString(), walkOnly: true }));
        if (generation.current !== token) return;
        const route = routes.find(isWalkingJourney);
        if (!route) { setError('Fant ingen oppdatert gangrute. Sist beregnede rute er bevart.'); return; }
        const updated = { ...snapshot, journey: route, origin: p.place, progress: snapshot.progress.legIndex === 0 ? snapshot.progress : initialProgress(route, Date.now()) };
        current.current = updated; setActive(updated); setNow(Date.now()); setError('');
        return;
      }
      if (snapshot.progress.needsReplan) {
        setReady(true);
        if (!snapshot.progress.place) { setRecovery([]); return; }
        if (!force && Date.now() - lastAlternatives.current < 60000) return;
        lastAlternatives.current = Date.now();
        const options = await provider.search(activeRequest(snapshot, { from: snapshot.progress.place, to: snapshot.destination, at: new Date().toISOString(), allowWalkOnly: true }));
        if (generation.current !== token) return;
        const valid = rankJourneys(options.filter(j => feasible(j, Date.now())), preference, Date.now()).slice(0, 3);
        setRecovery(valid); setError(valid.length ? '' : 'Ingen videre reiser funnet fra dette stedet. Prøv igjen eller endre startsted.');
        return;
      }
      const journey = await provider.refresh(snapshot.journey, snapshot.progress.legIndex);
      if (generation.current !== token) return;
      let updated = observedStops({ ...snapshot, journey }, Date.now());
      if (updated.stops !== snapshot.stops) { stopRequest.current++; setStopChoices([]); setStopBusy(false); }
      if (snapshot.progress.phase === 'alighted' && !feasible(journey, Date.now(), snapshot.progress.legIndex)) {
        updated = { ...updated, progress: { ...updated.progress, needsReplan: true } };
      }
      const at = Date.now();
      current.current = updated;
      setActive(updated);
      setNow(at);
      setReady(true);
      const stale = journey.legs.slice(snapshot.progress.legIndex).some(l => l.mode !== 'foot' && l.quality === 'stale');
      setError(stale ? 'Noen avganger kunne ikke oppdateres. Tidene er usikre; prøver igjen automatisk.' : '');
      if (stale || updated.progress.needsReplan) { setRecommendation(null); return; }
      const risk = [
        ...alertsFor(updated, at).filter(a => a.kind !== 'info').map(a => a.id),
        ...transfers(journey, at, snapshot.progress.legIndex).filter(t => t.status === 'tight' || t.status === 'missed').map(t => `${t.toIndex}:${Math.floor(t.margin)}`),
      ].sort().join('|');
      if (force || at - lastAlternatives.current >= 60000 || risk !== currentRisk.current) {
        currentRisk.current = risk;
        lastAlternatives.current = at;
        const context = replanContext(updated, at, positionRef.current);
        if (!context) { setRecommendation(null); return; }
        try {
          const alternatives = await provider.search(context.request);
          if (generation.current !== token) return;
          if (shouldCheckWalking(context)) {
            try {
              const walks = await provider.search({ ...context.request, walkOnly: true });
              alternatives.push(...shortWalks(walks));
            } catch { /* Transit advice remains usable if the separate walking lookup fails. */ }
          }
          if (generation.current !== token) return;
          setRecommendation(recommend(updated, alternatives, context, preference, Date.now()));
        } catch (e) {
          if (generation.current !== token) return;
          setRecommendation(null);
          setError(`Reisen er oppdatert, men alternativsøk feilet. ${message(e)}`);
        }
      }
    } catch (e) {
      if (generation.current !== token) return;
      const stale = { ...snapshot, journey: { ...snapshot.journey, legs: snapshot.journey.legs.map((l, i) => i >= snapshot.progress.legIndex && l.mode !== 'foot' ? { ...l, quality: 'stale' as const } : l) } };
      current.current = stale;
      setActive(stale); setRideChoices([]); setReady(true); setRecommendation(null); setRecovery([]); setError(message(e));
    } finally {
      if (inFlight.current === token) inFlight.current = null;
      if (generation.current === token) setBusy(false);
    }
  }, [scenario, preference, demoBase]);

  const boardingActions = useRef({ mutate });
  boardingActions.current = { mutate };
  useEffect(() => {
    setBoarding(null);
    setAlighting(null);
    if (!active || active.stay || active.demo || active.progress.step === 'arrived' || !gpsEnabled || paused) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    let samples: Position[] = [];
    setGpsStatus('Venter på posisjon …');
    void watchPosition(p => {
      if (disposed || !isForeground()) return;
      const snapshot = current.current;
      if (!snapshot) return;
      positionRef.current = p; setPosition(p);
      setGpsStatus(p.accuracy <= 35 ? 'GPS følger bevegelsen din' : 'GPS er unøyaktig. Bekreft påstigning manuelt.');
      if (samples.length && p.timestamp <= samples[samples.length - 1].timestamp) return;
      if (samples.length && p.timestamp - samples[samples.length - 1].timestamp > 45000) samples = [];
      samples = [...samples, p].filter(s => p.timestamp - s.timestamp <= 480000).slice(-120);
      if (snapshot.pendingRide) return;
      if (snapshot.progress.phase === 'onboard') {
        const stop = (snapshot.stops ?? []).find(s => !s.visited);
        const leg = snapshot.journey.legs[snapshot.progress.legIndex];
        // Observe arrival near the stop and subsequent travel away on the confirmed vehicle.
        if (stop?.mode === 'direct' && isTransitStop(stop.place) && leg?.calls?.some(c => samePlace(c.place, stop.place) && c.position > (leg.fromPosition ?? 0) && c.position < (leg.toPosition ?? Infinity))) {
          const good = samples.filter(s => s.accuracy <= 35 && s.timestamp >= snapshot.progress.confirmedAt);
          if (good.length >= 3 && good.slice(0, -2).some(s => distance(s.place, stop.place) <= 35) && good.slice(-2).every(s => distance(s.place, stop.place) > 100) && p.timestamp - good[0].timestamp < 180000) {
            boardingActions.current.mutate(markStop(snapshot, stop.id)); return;
          }
        }
        const evidence = detectAlighting(snapshot, samples, Date.now());
        if (evidence && !dismissedAlighting.current.has(evidence.key)) {
          setAlighting(previous => previous?.key === evidence.key ? previous : evidence);
        }
        return;
      }
      if (snapshot.progress.needsReplan) return;
      const evidence = detectBoarding(snapshot, samples, Date.now());
      const key = `${snapshot.startedAt}:${snapshot.journey.id}:${snapshot.progress.legIndex}`;
      if (!evidence || dismissedBoarding.current === key) { setBoarding(null); return; }
      if (evidence.confidence === 'automatic') {
        boardingActions.current.mutate({ ...snapshot, progress: { phase: 'onboard', step: 'onboard', legIndex: evidence.legIndex, confirmedAt: Date.now() } });
        setBoardingUndo(snapshot.progress);
      } else setBoarding(evidence);
    }, message => {
      if (!disposed) { samples = []; setBoarding(null); setAlighting(null); setGpsStatus(message); }
    }).then(cleanup => { if (disposed) cleanup(); else stop = cleanup; })
      .catch(e => { if (!disposed) setGpsStatus(message(e)); });
    return () => { disposed = true; stop?.(); };
  }, [active?.startedAt, active?.journey.id, active?.progress, active?.demo, gpsEnabled, paused]);

  useEffect(() => {
    const leg = boarding && active?.journey.legs[boarding.legIndex];
    if (boarding && (!position || now - position.timestamp > 20000 || !leg || leg.cancelled || leg.quality !== 'realtime' || now - leg.checkedAt > 90000)) setBoarding(null);
  }, [now, position, boarding, active]);

  useEffect(() => {
    if (alighting && (now - alighting.createdAt >= 60000 || paused)) {
      dismissedAlighting.current.add(alighting.key); setAlighting(null);
    }
  }, [now, paused, alighting]);

  useEffect(() => { saveState(active, preference); }, [active, preference]);
  useEffect(() => {
    if (!active) return;
    void cycle(true);
    const timer = setInterval(() => { void cycle(); }, 30000);
    return () => clearInterval(timer);
  }, [!!active, active?.startedAt, active?.progress, active?.pendingRide, cycle]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const visibility = () => {
      setRideChoices([]);
      generation.current++; stopRequest.current++; setStopBusy(false); setStopChoices([]); setResumePlace(false); walkRequest.current++; setWalkingBusy(false); setWalkingChoice(null);
      setRecommendation(null); setRecovery([]); setAlighting(null); setChoosingAlight(false); setLocatingAlight(false); setReady(false); setBusy(false);
      if (!isForeground()) setPaused(true);
      else { setPaused(false); setResumed(true); void cycle(true); }
    };
    return onVisibilityChange(visibility);
  }, [cycle]);
  useEffect(() => () => { generation.current++; searchId.current++; stopRequest.current++; walkRequest.current++; }, []);

  async function search(request: SearchRequest) {
    if (!demo) rememberPlaces([request.to, request.from, ...(request.stops ?? []).map(s => s.place)]);
    const id = ++searchId.current;
    setSearching(true); setError(''); setResults([]);
    const base = Date.now();
    if (demo && !active) setDemoBase(base);
    try {
      const list = await (demo ? demoProvider(active?.demoBase ?? base, scenario) : entur).search(request);
      if (searchId.current !== id) return;
      setResults(list);
      if (!list.length) setError('Ingen reiser funnet. Prøv andre steder eller et annet tidspunkt.');
    } catch (e) { if (searchId.current === id) setError(message(e)); }
    finally { if (searchId.current === id) setSearching(false); }
  }

  function follow(journey: Journey, request: SearchRequest) {
    mutate({ journey, origin: request.from, destination: request.to, stops: request.stops ?? [], startedAt: Date.now(), progress: initialProgress(journey, Date.now()), demo, demoBase: demo ? demoBase : undefined });
  }

  function confirmBoard() {
    if (!active || active.progress.needsReplan) return;
    const legIndex = active.journey.legs.findIndex((l, i) => i >= active.progress.legIndex && l.mode !== 'foot');
    if (legIndex >= 0) mutate({ ...active, progress: { phase: 'onboard', step: 'onboard', legIndex, confirmedAt: Date.now() } });
  }

  function dismissBoarding() {
    if (!active) return;
    dismissedBoarding.current = `${active.startedAt}:${active.journey.id}:${active.progress.legIndex}`;
    setBoarding(null);
  }

  function undoBoarding() {
    if (!active || !boardingUndo) return;
    dismissedBoarding.current = `${active.startedAt}:${active.journey.id}:${boardingUndo.legIndex}`;
    mutate({ ...active, progress: boardingUndo });
  }

  function confirmStop() {
    if (!active || active.progress.needsReplan) return;
    const legIndex = active.journey.legs.findIndex((l, i) => i >= active.progress.legIndex && l.mode !== 'foot');
    if (legIndex >= 0) mutate({ ...active, progress: { ...active.progress, phase: 'waiting', step: 'waiting', legIndex, place: active.journey.legs[legIndex].from, locationVerified: true, confirmedAt: Date.now() } });
  }

  function finish() {
    if (!active) return;
    const pending = (active.stops ?? []).filter(s => !s.visited);
    const pauseIndex = pending.findIndex(s => s.mode === 'pause');
    if ((pauseIndex < 0 ? pending : pending.slice(0, pauseIndex)).some(s => s.mode === 'direct')) { setError("Bekreft at via-stoppene er besøkt først."); return; }
    mutate({ ...active, progress: { ...active.progress, phase: 'alighted', step: 'arrived', legIndex: active.journey.legs.length, needsReplan: false, confirmedAt: Date.now() } });
  }

  function alightFromCurrent(snapshot: ActiveJourney, place: Place): ActiveJourney {
    const next = afterAlighting(snapshot,place,Date.now());
    return snapshot.pendingRide ? { ...next, pendingRide: undefined, walkingOnly: false, progress: { ...next.progress, needsReplan: true } } : next;
  }
  function boardDeparture(d: Departure, destination: Place) {
    if (d.cancelled || !d.boarding || Date.now()-d.checkedAt>=90000) { setError('Hent avgangen på nytt før du bekrefter.'); return false; }
    if (!demo) rememberPlaces([destination]);
    const next = confirmedRide(d,destination,Date.now(),current.current,demo);
    mutate(next); saveState(next,preference); return true;
  }
  function confirmNextCall(position: number) {
    const snapshot = current.current;
    if (!snapshot?.pendingRide || !snapshot.journey.legs[0].calls?.some(c => c.position === position && c.position>snapshot.pendingRide!.departure.position && !c.actualDeparture && !c.cancelled)) return;
    mutate({ ...snapshot, pendingRide: { ...snapshot.pendingRide, nextPosition: position, nextConfirmedAt: Date.now() } });
  }
  function acceptRide(journey: Journey) {
    const snapshot = current.current;
    if (!snapshot?.pendingRide || !rideChoices.includes(journey) || Date.now()-journey.fetchedAt>=90000) return;
    const leg = snapshot.journey.legs[0];
    const next = upcomingPosition(snapshot.pendingRide,leg.calls ?? [],Date.now(),leg.checkedAt,positionRef.current);
    if (next === undefined || next>(journey.legs[0].toPosition ?? 0)) { setRideChoices([]); setError('Fremdriften må bekreftes på nytt før du velger videreplan.'); return; }
    mutate({ ...snapshot, pendingRide: undefined, journey, progress: { phase: 'onboard', step: 'onboard', legIndex: 0, confirmedAt: snapshot.progress.confirmedAt } });
  }
  function followDeparture(journey: Journey, destination: Place) {
    if (current.current?.progress.phase === 'onboard') { setError('Bekreft avstigning før du planlegger en annen påstigning.'); return false; }
    if (Date.now()-journey.fetchedAt>=90000 || !feasible(journey,Date.now())) { setError('Avgangen kan ha gått. Hent et nytt forslag.'); return false; }
    mutate({ journey, destination, origin: journey.legs[0].from, stops: current.current?.stops ?? [], demo, startedAt: Date.now(), progress: initialProgress(journey,Date.now()) }); return true;
  }
  async function confirmAlight() {
    const snapshot = current.current;
    if (!snapshot || snapshot.progress.phase !== 'onboard') return;
    if (snapshot.demo) { setChoosingAlight(true); return; }
    const token = generation.current;
    setLocatingAlight(true); setError(''); setAlighting(null);
    try {
      const p = usablePosition(positionRef.current, Date.now()) ? positionRef.current : await locate();
      if (generation.current !== token) return;
      if (!usablePosition(p, Date.now())) throw new Error('Posisjonen er for usikker. Velg hvor du gikk av.');
      positionRef.current = p; setPosition(p);
      const latest = current.current!;
      mutate(alightFromCurrent(latest, alightingPlace(latest, p)));
    } catch (e) {
      if (generation.current === token) { setChoosingAlight(true); setError(message(e)); }
    } finally { if (generation.current === token) setLocatingAlight(false); }
  }

  function chooseAlightingPlace(place: Place) {
    const snapshot = current.current;
    if (!snapshot) return;
    if (snapshot.progress.phase === 'onboard') mutate(alightFromCurrent(snapshot, place));
    else mutate({ ...snapshot, progress: { ...snapshot.progress, place, locationVerified: true, needsReplan: true, confirmedAt: Date.now() } });
  }

  function acceptAlighting() {
    if (!alighting || Date.now() - alighting.createdAt >= 60000) { setAlighting(null); return; }
    // Re-read position on confirmation rather than reusing the older suggestion.
    void confirmAlight();
  }

  function dismissAlighting() {
    if (alighting) dismissedAlighting.current.add(alighting.key);
    setAlighting(null);
  }

  function acceptRecovery(journey: Journey) {
    const snapshot = current.current;
    if (!snapshot?.progress.needsReplan || !recovery.includes(journey)) return;
    if (Date.now() - journey.fetchedAt >= 90000 || !feasible(journey, Date.now())) { setRecovery([]); void cycle(true); return; }
    mutate({ ...snapshot, routeStartIndex: 0, journey, walkingOnly: isWalkingJourney(journey), origin: snapshot.progress.place!, progress: initialProgress(journey, Date.now()) });
  }

  function acceptAlternative() {
    if (!active || !recommendation) return;
    if (Date.now() - recommendation.journey.fetchedAt > 90000 || !feasible(recommendation.journey, Date.now(), recommendation.progress.legIndex, recommendation.progress.phase === 'onboard')) {
      setRecommendation(null); void cycle(true); return;
    }
    mutate({ ...active, routeStartIndex: recommendation.progress.legIndex, journey: recommendation.journey, walkingOnly: isWalkingJourney(recommendation.journey), progress: { ...recommendation.progress, step: recommendation.progress.phase === 'onboard' ? 'onboard' : initialProgress(recommendation.journey, Date.now()).step }, origin: recommendation.progress.phase === 'waiting' ? recommendation.journey.legs[0].from : active.origin });
  }

  async function requestWalking() {
    const snapshot = current.current;
    if (!snapshot || snapshot.stay || snapshot.progress.phase === 'onboard' || (snapshot.progress.step === 'arrived' && !snapshot.progress.needsReplan)) return;
    const id = ++walkRequest.current, token = generation.current;
    setWalkingBusy(true); setWalkingChoice(null); setError('');
    try {
      if (!snapshot.demo && !usablePosition(positionRef.current, Date.now())) {
        try {
          const p = await locate();
          if (id !== walkRequest.current || token !== generation.current) return;
          if (usablePosition(p, Date.now())) { positionRef.current = p; setPosition(p); }
        } catch { /* Show the known search origin explicitly before the user accepts. */ }
      }
      const context = replanContext(snapshot, Date.now(), snapshot.demo ? undefined : positionRef.current);
      if (!context) throw new Error('Velg hvor du er med «Endre startsted» før vi beregner gangruten.');
      if (!snapshot.demo && context.request.from.name === 'Min posisjon') context.request.from = await namePosition(context.request.from);
      if (id !== walkRequest.current || token !== generation.current) return;
      const provider = snapshot.demo ? demoProvider(snapshot.demoBase ?? demoBase, scenario) : entur;
      const routes = await provider.search({ ...context.request, at: new Date().toISOString(), walkOnly: true });
      if (id !== walkRequest.current || token !== generation.current) return;
      const route = routes.filter(isWalkingJourney).sort((a, b) => Date.parse(a.legs.at(-1)!.expectedEnd) - Date.parse(b.legs.at(-1)!.expectedEnd))[0];
      if (!route) throw new Error('Fant ingen gangrute. Reisen er beholdt; prøv igjen eller velg et annet startsted.');
      setWalkingChoice(route);
    } catch (e) { if (id === walkRequest.current && token === generation.current) setError(message(e)); }
    finally { if (id === walkRequest.current) setWalkingBusy(false); }
  }

  function acceptWalking() {
    const snapshot = current.current;
    if (!snapshot || !walkingChoice || snapshot.progress.phase === 'onboard') return;
    if (Date.now() - walkingChoice.fetchedAt >= 90000) { void requestWalking(); return; }
    mutate({ ...snapshot, routeStartIndex: 0, walkingOnly: true, journey: walkingChoice, origin: walkingChoice.legs[0].from, progress: initialProgress(walkingChoice, Date.now()) });
  }


  async function findStopRoutes(stops: PlannedStop[], continuing = false, place?: Place) {
    const snapshot = current.current;
    if (!snapshot) return;
    const token = generation.current, id = ++stopRequest.current;
    setStopBusy(true); setStopChoices([]); setError(''); setResumePlace(false);
    try {
      let origin = place;
      if (continuing && !origin) {
        if (snapshot.demo) { setResumePlace(true); return; }
        const p = usablePosition(positionRef.current, Date.now()) ? positionRef.current : await locate();
        if (token !== generation.current || id !== stopRequest.current) return;
        if (!usablePosition(p, Date.now())) throw new Error('Velg hvor du er før du fortsetter.');
        positionRef.current = p; setPosition(p); origin = await namePosition(p.place);
      }
      if (token !== generation.current || id !== stopRequest.current) return;
      if (snapshot.stay && origin) {
        const savedOrigin = { ...snapshot, stay: { ...snapshot.stay, continuationFrom: origin } };
        current.current = savedOrigin; setActive(savedOrigin);
      }
      const next = { ...snapshot, stops, stay: undefined, walkingOnly: false };
      const context = continuing || snapshot.stay
        ? origin ? { request: activeRequest(next, { from: origin, to: next.destination, at: new Date().toISOString(), allowWalkOnly: true }), prefix: [], progress: initialProgress(snapshot.journey, Date.now()) } : null
        : replanContext(next, Date.now(), positionRef.current);
      if (!context) { setResumePlace(snapshot.progress.phase !== 'onboard'); throw new Error(snapshot.progress.phase === 'onboard' ? 'Vent til en kommende avstigning kan bekreftes med ferske reisedata.' : 'Velg startsted for å finne reisen videre.'); }
      const provider = snapshot.demo ? demoProvider(snapshot.demoBase ?? demoBase, scenario) : entur;
      const routes = await provider.search({ ...context.request, allowWalkOnly: true });
      if (token !== generation.current || id !== stopRequest.current) return;
      const options = rankJourneys(routes.filter(j => feasible(j, Date.parse(context.request.at))), preference, Date.now()).slice(0, 3).map(j => {
        const journey = { ...j, legs: [...context.prefix, ...j.legs] };
        return { journey, active: { ...next, routeStartIndex: context.prefix.length ? context.progress.legIndex : 0, journey, origin: context.prefix.length ? next.origin : context.request.from, progress: context.prefix.length ? context.progress : initialProgress(journey, Date.now()), walkingOnly: isWalkingJourney(journey) } };
      });
      setStopChoices(options);
      if (!options.length) setError('Ingen videre reiser funnet. Prøv igjen eller endre startsted.');
    } catch (e) {
      if (token === generation.current && id === stopRequest.current) { setError(message(e)); if (continuing) setResumePlace(true); }
    } finally { if (id === stopRequest.current) setStopBusy(false); }
  }
  function acceptStopRoute(choice: { journey: Journey; active: ActiveJourney }) {
    if (!stopChoices.includes(choice)) return;
    if (Date.now() - choice.journey.fetchedAt >= 90000 || !feasible(choice.journey, Date.now(), choice.active.progress.legIndex, choice.active.progress.phase === 'onboard')) { setStopChoices([]); setError('Forslaget er blitt gammelt. Søk på nytt.'); return; }
    const latestVisited = new Set((current.current?.stops ?? []).filter(s => s.visited).map(s => s.id));
    mutate({ ...choice.active, stops: choice.active.stops?.map(s => latestVisited.has(s.id) ? { ...s, visited: true } : s) });
  }
  function confirmPlannedStop(id: string) {
    if (!current.current) return;
    mutate(markStop(current.current, id));
  }

  function stop() {
    searchId.current++; mutate(null); setResults([]); setSearching(false); setBusy(false); setResumed(false);
    setScenario('normal'); setRestartKey(key => key + 1);
    // Persist immediately so closing the app right after tapping cannot restore the old trip.
    saveState(null, preference);
  }

  function changePreference(p: Preference) { setRideChoices([]); generation.current++; stopRequest.current++; setStopChoices([]); setStopBusy(false); setLocatingAlight(false); setBusy(false); setPreference(p); setRecommendation(null); setRecovery([]); lastAlternatives.current = 0; }
  function changeScenario(s: Scenario) { setRideChoices([]); generation.current++; stopRequest.current++; setStopChoices([]); setStopBusy(false); setLocatingAlight(false); setBusy(false); setScenario(s); setRecommendation(null); lastAlternatives.current = 0; }
  function changeMode(value: boolean) {
    searchId.current++; mutate(null); setBusy(false); setSearching(false); setDemo(value); setScenario('normal'); setResults([]); setDemoBase(Date.now());
  }

  return { active, preference, demo, scenario, results: rankJourneys(results, preference, now), recommendation: ready && !paused && !choosingAlight && !locatingAlight && recommendation && now - recommendation.journey.fetchedAt < 90000 ? recommendation : null,
    boardDeparture, followDeparture, confirmNextCall, acceptRide, rideChoices: ready && !paused ? rideChoices.filter(j => now-j.fetchedAt<90000) : [],
    findStopRoutes, acceptStopRoute, confirmPlannedStop, stopChoices: paused ? [] : stopChoices, stopBusy, resumePlace,
    cancelStopRoutes: () => { stopRequest.current++; setStopChoices([]); setStopBusy(false); setResumePlace(false); },
    error, busy, searching, ready, paused, resumed, now, position, restartKey,
    requestWalking, acceptWalking, walkingBusy, walkingChoice: !paused && walkingChoice && now - walkingChoice.fetchedAt < 90000 ? walkingChoice : null,
    cancelWalking: () => { walkRequest.current++; setWalkingBusy(false); setWalkingChoice(null); },
    alighting, choosingAlight, locatingAlight, confirmStop, finish, chooseAlightingPlace, acceptAlighting, dismissAlighting,
    editAlightingPlace: () => { setChoosingAlight(true); setAlighting(null); }, cancelAlighting: () => setChoosingAlight(false),
    recovery: ready && !paused ? recovery.filter(j => now - j.fetchedAt < 90000) : [], acceptRecovery,
    gpsEnabled, gpsStatus, boarding, boardingUndo, dismissBoarding, undoBoarding,
    toggleGps: () => { setGpsEnabled(v => !v); setBoarding(null); setAlighting(null); },
    alerts: active && ready && !paused && !choosingAlight && !locatingAlight ? alertsFor(active, now) : [],
    invalidateSearch: () => { searchId.current++; setResults([]); setSearching(false); },
    search, follow, confirmBoard, confirmAlight, acceptAlternative, setPosition: (p: Position) => { positionRef.current = p; setPosition(p); },
    changePreference, changeScenario, changeMode, stop, refresh: () => cycle(true),
  };
}
function message(e: unknown) { return e instanceof Error ? e.message : 'Noe gikk galt. Prøv igjen.'; }
