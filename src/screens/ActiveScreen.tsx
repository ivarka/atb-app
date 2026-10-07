import { PendingRideScreen } from './PendingRideScreen';
import { DepartureBoard } from '../ui/DepartureBoard';
import { StopEditor } from '../ui/StopEditor';
import { nextPause, remainingStops } from '../domain/stops';
import { vehicleName } from '../domain/transport';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SCENARIOS, DEMO_WRONG_STOP } from '../demo/provider';
import { arrival, transfers } from '../domain/journey';
import { onboardTiming, stepIndex, stepsFor } from '../domain/progress';
import { Place, PlannedStop, Departure } from '../domain/types';
import { AlertCard, Button, clock, JourneyCard, PlaceField, Preferences, Timeline, TransportIcon } from '../ui/components';
import { colors, s } from '../ui/theme';
import { Travel } from './PlanningScreen';

export function ActiveScreen({ travel, onBack, onDepartures }: { travel: Travel; onBack: () => void; onDepartures: (onboard: boolean, d?: Departure, place?: Place) => void }) {
  const [showSteps,setShowSteps] = useState(false), [showTimes,setShowTimes] = useState(false);
  const [scrollY,setScrollY] = useState(0), [boardBox,setBoardBox] = useState({y:0,height:1});
  const height = useWindowDimensions().height;
  const active = travel.active!;
  const [editingStops, setEditingStops] = useState(false);
  const [draftStops, setDraftStops] = useState<PlannedStop[]>([]);
  const [continuationPlace, setContinuationPlace] = useState<Place>();
  const pause = nextPause(active);
  const pending = remainingStops(active);
  const stay = active.stay;
  const [options, setOptions] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place>();
  const steps = stepsFor(active.journey), index = stepIndex(active), step = steps[index];
  const p = active.progress;
  const nextBus = active.journey.legs.find((l, i) => i >= p.legIndex && l.mode !== 'foot');
  const leg = active.journey.legs[p.legIndex];
  const recovery = !!p.needsReplan;
  const uncertain = !travel.ready || travel.paused;
  const broken = !uncertain && (active.journey.legs.slice(p.legIndex).some(l => l.cancelled && l.quality !== 'stale') || transfers(active.journey, travel.now, p.legIndex).some(t => t.status === 'missed'));
  const timing = onboardTiming(active, uncertain ? Number.MAX_SAFE_INTEGER : travel.now);
  const choices = Array.from(new Map([...(leg?.calls?.filter(c => c.alighting).map(c => c.place) ?? []), ...(leg ? [leg.to] : [])].map(place => [place.quayId ?? place.id ?? place.name, place])).values());
  if (active.pendingRide) return <PendingRideScreen travel={travel} onBack={onBack} onDepartures={() => onDepartures(true)} />;
  return <ScrollView onScroll={e=>setScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={100} contentContainerStyle={{ padding: 20, width: '100%', maxWidth: 900, alignSelf: 'center', gap: 18 }} keyboardShouldPersistTaps="handled">
    <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}><Button small secondary label="← Planlegg reise" onPress={onBack} /><Button small secondary label="Reisevalg" onPress={() => setOptions(!options)} /></View>
    <Text accessibilityRole="header" style={s.title}>Reisen din</Text>
    <Button small secondary label="Avslutt og start på nytt" onPress={() => { travel.stop(); onBack(); }} />
    <View style={s.row}>{travel.busy && <ActivityIndicator color={colors.green} />}<Text style={s.muted}>{stay ? 'Opphold · overvåking pauset' : travel.paused ? 'Overvåking pauset' : !travel.ready ? 'Oppdaterer reisen …' : '● Følger reisen'}</Text></View>
    {options && <View style={[s.card, { gap: 16 }]}><Text style={s.text}>{active.origin.name} → {active.destination.name}</Text><Button secondary label="Endre stopp" onPress={() => { setDraftStops(active.stops ?? []); setEditingStops(true); travel.cancelStopRoutes(); }} /><Preferences value={travel.preference} onChange={travel.changePreference} /><Button secondary label="Avslutt reisen" onPress={() => { travel.stop(); onBack(); }} />{!travel.demo && <><Text style={s.muted}>{travel.paused ? 'GPS pauset' : travel.gpsEnabled ? travel.gpsStatus : 'Automatisk påstigning er slått av'}</Text><Button small secondary label={travel.gpsEnabled ? 'Slå av automatisk påstigning' : 'Slå på automatisk påstigning'} onPress={travel.toggleGps} /><Text style={s.muted}>Posisjon brukes også til å foreslå avstigning mens du er om bord. GPS kan ta feil. Sporingen pauses i bakgrunnen.</Text></>}</View>}
    {travel.resumed && !stay && <Text style={s.muted}>Overvåkingen kan ha vært pauset mens siden var inaktiv. Vi henter nye data før vi gir råd.</Text>}
    {(stay || editingStops) && <View style={[s.card, { gap: 14 }]}>
      <Text style={s.title}>{editingStops ? 'Endre planlagte stopp' : `Opphold ved ${stay?.place.name}`}</Text>
      {editingStops && <StopEditor value={draftStops} onChange={stops => { setDraftStops(stops); travel.cancelStopRoutes(); }} demo={travel.demo} />}
      {stay && <Text style={s.text}>Reisen er pauset. Ny rute beregnes fra der du er når du er klar.</Text>}
      <Button label={travel.stopBusy ? 'Finner videre reiser …' : editingStops ? 'Finn reise med disse stoppene' : 'Klar til å fortsette'} disabled={travel.stopBusy} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], !!stay)} />
      {(travel.resumePlace || stay) && <>{travel.demo && <Button secondary label="Jeg har gått til Studentersamfundet" onPress={() => { setContinuationPlace(DEMO_WRONG_STOP); travel.cancelStopRoutes(); }} />}<Text style={s.muted}>Velg startsted hvis GPS ikke er tilgjengelig, eller du vil velge selv.</Text><PlaceField label="Hvor er du nå?" value={continuationPlace} onChange={p => { setContinuationPlace(p); travel.cancelStopRoutes(); }} demo={travel.demo} /><Button secondary label="Fortsett fra valgt sted" disabled={!continuationPlace} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], true, continuationPlace)} />{stay?.continuationFrom && <Button secondary label={`Prøv igjen fra ${stay.continuationFrom.name}`} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], true, stay.continuationFrom)} />}{stay && <Button secondary label={`Jeg er fortsatt ved ${stay.place.name}`} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], true, stay.place)} />}</>}
      {travel.stopChoices.map((choice, i) => <View key={i} testID="stop-route" style={{ gap: 12 }}><Text style={s.text}>Videre fra {choice.active.origin.name}</Text><JourneyCard journey={choice.journey} now={travel.now} compact /><Button label="Velg denne videre reisen" onPress={() => { travel.acceptStopRoute(choice); setEditingStops(false); }} /></View>)}
      {editingStops && <Button secondary label="Avbryt endring" onPress={() => { setEditingStops(false); travel.cancelStopRoutes(); }} />}
    </View>}
    {!stay && <View style={[s.card, { borderTopWidth: 4, borderTopColor: colors.green, gap: 16 }]}>
      <Text style={[s.label, { color: colors.green }]}>{recovery ? 'VIDERE REISE' : `Steg ${index + 1} av ${steps.length} · ${step.label}`}</Text>
      {!recovery && leg && <TransportIcon mode={leg.mode} />}
      <Text style={[s.title, { fontSize: 28 }]}>{recovery ? 'Må oppdateres fra der du er' : step.action}</Text>
      {recovery ? <Text style={s.text}>{p.place ? `Du har gått av ved ${p.place.name}. Vi finner veien videre til ${active.destination.name}.` : 'Velg hvor du gikk av for å finne veien videre.'}</Text> : <>
        {step.at && <Text style={s.text}>{step.kind === 'onboard' ? 'Forventet avstigning' : step.kind === 'waiting' ? 'Avgang' : 'Forventet fremme'} {clock(step.at)}{uncertain ? ' · sist kjent tid' : ''}</Text>}
        {timing && <Text style={s.text}>{timing}</Text>}
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          {p.step !== 'arrived' && (p.phase === 'onboard' ? <Button label={travel.locatingAlight ? 'Henter avstigningssted …' : 'Jeg har gått av'} disabled={travel.locatingAlight} onPress={() => void travel.confirmAlight()} /> : nextBus ? <>
            {step.kind === 'walking' && <Button label="Jeg er på holdeplassen" onPress={travel.confirmStop} />}
            <Button secondary={step.kind === 'walking'} label="Jeg er om bord" onPress={travel.confirmBoard} />
          </> : <Button label="Jeg er fremme" onPress={travel.finish} />)}
          {p.step === 'arrived' && <Button label="Avslutt reisen" onPress={() => { travel.stop(); onBack(); }} />}
        </View>
        <View style={s.divider} /><Text style={s.label}>{pause ? `ANKOMST TIL ${pause.place.name.toUpperCase()}` : broken ? 'ANKOMST ER USIKKER' : uncertain ? 'SIST KJENTE ANKOMST' : 'FORVENTET ANKOMST'}</Text>
        <Text style={{ fontSize: 36, fontWeight: '600', color: broken ? colors.muted : colors.ink, textDecorationLine: broken ? 'line-through' : 'none' }}>{clock(arrival(active.journey))}</Text>
      </>}
      {pause && <Text style={s.muted}>Sluttankomst: Beregnes når du fortsetter</Text>}
      <Text style={s.muted}>Reisedata oppdatert {clock(active.journey.fetchedAt)}</Text>
      <View style={[s.row, { flexWrap: 'wrap' }]}><Button small secondary label={recovery ? 'Prøv igjen' : 'Oppdater nå'} disabled={travel.busy} onPress={() => void travel.refresh()} />{recovery && <Button small secondary label="Endre startsted" onPress={travel.editAlightingPlace} />}</View>
      {!travel.demo && !options && <Text style={s.muted}>{travel.paused ? 'GPS pauset' : travel.gpsEnabled ? travel.gpsStatus : 'Automatisk påstigning er slått av'}</Text>}
    </View>}
    {!stay && !recovery && p.step === 'waiting' && nextBus && <View onLayout={e=>setBoardBox(e.nativeEvent.layout)}>
      <Button small secondary label="Endre holdeplass" onPress={()=>onDepartures(false,undefined,nextBus.from)} />
      <DepartureBoard place={nextBus.from} demo={travel.demo} visible={scrollY<boardBox.y+boardBox.height && scrollY+height>boardBox.y} selectedId={`${nextBus.serviceJourneyId}@${nextBus.serviceDate}`} onSelect={(d,onboard)=>onDepartures(onboard,d,nextBus.from)} />
    </View>}
    <Button secondary label="Jeg er på en annen avgang" onPress={()=>onDepartures(true)} />
    {(active.stops ?? []).length > 0 && <View style={[s.card, { gap: 12 }]}><Text style={s.title}>Planlagte stopp</Text>{(active.stops ?? []).map(stop => <View key={stop.id} style={{ gap: 8 }}><Text style={s.text}>{stop.visited ? '✓ Besøkt' : 'Senere'} · {stop.place.name} · {stop.mode === 'pause' ? 'Opphold' : 'Direkte videre'}</Text>{!stay && !editingStops && pending[0]?.id === stop.id && <Button small secondary label={stop.mode === 'pause' ? `Jeg er ved ${stop.place.name} – start opphold` : `Bekreft passert ${stop.place.name}`} onPress={() => travel.confirmPlannedStop(stop.id)} />}</View>)}</View>}
    {!stay && p.phase !== 'onboard' && (p.step !== 'arrived' || recovery) && !active.walkingOnly && <Button secondary label={travel.walkingBusy ? 'Beregner gangrute …' : 'Jeg vil gå resten'} disabled={travel.walkingBusy} onPress={() => void travel.requestWalking()} />}
    {!stay && active.walkingOnly && <Text style={s.muted}>Du går resten. Ankomsten er beregnet fra siste kjente posisjon. Med fersk GPS oppdateres gangruten hvert minutt.</Text>}
    {travel.walkingChoice && <View testID="walking-choice" style={[s.card, { gap: 14 }]}><Text style={s.title}>Gå resten av reisen</Text><Text style={s.text}>Fra {travel.walkingChoice.legs[0].from.name} · {Math.round(travel.walkingChoice.legs.reduce((sum, l) => sum + l.distance, 0))} meter</Text><JourneyCard journey={travel.walkingChoice} now={travel.now} compact /><Text style={s.muted}>Den valgte reisen beholdes til du bekrefter.</Text><Button label="Jeg går denne veien" onPress={travel.acceptWalking} /><Button secondary label="Behold reisen" onPress={travel.cancelWalking} /></View>}
    {travel.choosingAlight && <View style={[s.card, { gap: 14 }]}><Text style={s.title}>Hvor gikk du av?</Text><Text style={s.muted}>Velg faktisk sted. Planlagt stopp er bare et forslag.</Text>
      {p.phase === 'onboard' && choices.map(place => <Button key={place.quayId ?? place.id ?? place.name} secondary label={`Jeg gikk av på ${place.name}`} onPress={() => travel.chooseAlightingPlace(place)} />)}
      {travel.demo && <Button secondary label={`Jeg gikk av på ${DEMO_WRONG_STOP.name}`} onPress={() => travel.chooseAlightingPlace(DEMO_WRONG_STOP)} />}
      {!travel.demo && <><PlaceField label="Søk etter avstigningssted" value={selectedPlace} onChange={setSelectedPlace} demo={false} /><Button label="Bruk dette stedet" disabled={!selectedPlace} onPress={() => selectedPlace && travel.chooseAlightingPlace(selectedPlace)} /></>}
      <Button small secondary label="Avbryt" onPress={travel.cancelAlighting} />
    </View>}
    {travel.alighting && !travel.choosingAlight && <View accessibilityRole="alert" style={[s.card, { gap: 12 }]}><Text style={s.title}>Har du gått av her?</Text><Text style={s.text}>{travel.alighting.place.name}</Text><Text style={s.muted}>Bevegelsen din tyder på avstigning. Bekreft før vi oppdaterer reisen.</Text><Button label="Ja, jeg har gått av" onPress={travel.acceptAlighting} /><Button secondary label="Nei, jeg er fortsatt om bord" onPress={travel.dismissAlighting} /></View>}
    {travel.boarding && <View accessibilityRole="alert" style={[s.card, { gap: 10 }]}><Text style={s.text}>Vi tror du er på {nextBus ? vehicleName(nextBus) : 'avgangen'} – stemmer det?</Text><Button label="Ja, jeg er om bord" onPress={travel.confirmBoard} /><Button secondary label="Nei, ikke denne avgangen" onPress={travel.dismissBoarding} /></View>}
    {travel.boardingUndo && <View style={[s.card, { gap: 10 }]}><Text style={s.muted}>Påstigning registrert automatisk ut fra bevegelsen din og avgangens tider. GPS kan ta feil.</Text><Button secondary label="Angre påstigning" onPress={travel.undoBoarding} /></View>}
    {!!travel.error && <AlertCard alert={{ id: 'error', kind: 'warning', title: 'Oppdatering fra reiseassistenten', detail: travel.error }} />}
    {travel.alerts.map(a => <AlertCard key={a.id} alert={a} />)}
    {recovery && travel.recovery.map((j, i) => <View key={j.id || i} testID="recovery-option" style={[s.card, { gap: 14 }]}><Text style={s.title}>Videre fra {p.place?.name}</Text><JourneyCard journey={j} now={travel.now} compact /><Button label="Velg denne videre reisen" onPress={() => travel.acceptRecovery(j)} /></View>)}
    {!stay && !editingStops && !recovery && travel.recommendation && <View testID="recommendation" style={[s.card, { gap: 14, borderColor: colors.green }]}><Text style={s.title}>{travel.recommendation.reason}</Text><JourneyCard journey={travel.recommendation.journey} now={travel.now} compact /><Button label="Bytt til denne reisen →" onPress={travel.acceptAlternative} /></View>}
    {!stay && !recovery && <Button secondary label={showSteps ? "Skjul steg for steg" : "Vis steg for steg"} onPress={()=>setShowSteps(!showSteps)} />}
    {!stay && !recovery && showSteps && <View style={[s.card, { gap: 14 }]}><Text style={s.title}>Steg for steg</Text>{steps.map((item, i) => <View key={`${item.kind}:${item.legIndex}`} style={{ padding: 14, borderRadius: 12, gap: 5, backgroundColor: i === index ? colors.soft : colors.white, borderWidth: i === index ? 2 : 1, borderColor: i === index ? colors.green : colors.border, opacity: i < index ? .65 : 1 }}><Text style={[s.label, { color: colors.green }]}>{i < index ? '✓ Fullført' : i === index ? 'Nå' : 'Senere'} · Steg {i + 1}</Text><View style={s.row}>{active.journey.legs[item.legIndex] && <TransportIcon mode={active.journey.legs[item.legIndex].mode} />}<Text style={[s.text, { flexShrink: 1 }]}>{item.label}</Text></View>{item.at && <Text style={s.muted}>{clock(item.at)}</Text>}</View>)}</View>}
    {!stay && !recovery && <Button secondary label={showTimes ? "Skjul tider og overganger" : "Vis tider og overganger"} onPress={()=>setShowTimes(!showTimes)} />}
    {!stay && !recovery && showTimes && <View style={[s.card, { gap: 14 }]}><Text style={s.title}>Tider og overganger</Text><Timeline journey={active.journey} now={uncertain ? Number.MAX_SAFE_INTEGER : travel.now} currentIndex={p.legIndex} /></View>}
    {travel.demo && <View style={[s.card, { gap: 12 }]}><Text style={s.title}>Demo · simulerte hendelser</Text><View style={[s.row, { flexWrap: 'wrap' }]}>{SCENARIOS.map(scenario => <Button small key={scenario.id} secondary={travel.scenario !== scenario.id} label={scenario.label} onPress={() => travel.changeScenario(scenario.id)} />)}</View><Text style={s.muted}>Prøv «Jeg har gått av» og velg et annet stopp for å teste ny videre reise.</Text></View>}
  </ScrollView>;
}
