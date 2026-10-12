import { JourneyStrip } from '../ui/JourneyStrip';
import { SettingsButton, useSettings } from '../ui/Settings';
import { PendingRideScreen } from './PendingRideScreen';
import { DepartureBoard } from '../ui/DepartureBoard';
import { StopEditor } from '../ui/StopEditor';
import { nextPause, remainingStops } from '../domain/stops';
import { vehicleName } from '../domain/transport';
import React, { useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SCENARIOS, DEMO_WRONG_STOP } from '../demo/provider';
import { arrival, transfers, isFresh } from '../domain/journey';
import { onboardTiming, stepIndex, stepsFor } from '../domain/progress';
import { Place, PlannedStop, Departure } from '../domain/types';
import { AlertCard, Button, clock, JourneyCard, PlaceField, Timeline, TransportIcon } from '../ui/components';
import { colors, s } from '../ui/theme';
import { Travel } from './PlanningScreen';

import { DetailSheet } from '../ui/DetailSheet';
import { TravelStatus } from '../ui/TravelStatus';
export function ActiveScreen({ travel, onBack, onDepartures }: { travel: Travel; onBack: () => void; onDepartures: (onboard: boolean, d?: Departure, place?: Place) => void }) {
  const [showCompleted,setShowCompleted] = useState(false);
  const [panel,setPanel] = useState<string | null>(null);
  const [scrollY,setScrollY] = useState(0), [boardBox,setBoardBox] = useState({y:0,height:1});
  const height = useWindowDimensions().height;
  const settings = useSettings();
  const active = travel.active!;
  const [editingStops, setEditingStops] = useState(false);
  const [draftStops, setDraftStops] = useState<PlannedStop[]>([]);
  const [continuationPlace, setContinuationPlace] = useState<Place>();
  const pause = nextPause(active);
  const pending = remainingStops(active);
  const stay = active.stay;

  const [selectedPlace, setSelectedPlace] = useState<Place>();
  const steps = stepsFor(active.journey), index = stepIndex(active), step = steps[index];
  const p = active.progress;
  const nextBus = active.journey.legs.find((l, i) => i >= p.legIndex && l.mode !== 'foot');
  const leg = active.journey.legs[p.legIndex];
  const recovery = !!p.needsReplan;
  const uncertain = !travel.ready || travel.paused;
  const uncertainTime = uncertain || !!(leg && leg.mode !== 'foot' && !isFresh(leg,travel.now));
  const uncertainArrival = uncertain || active.journey.legs.slice(p.legIndex).some(l=>l.mode!=='foot'&&!isFresh(l,travel.now));
  const broken = !uncertain && (active.journey.legs.slice(p.legIndex).some(l => l.cancelled && l.quality !== 'stale') || transfers(active.journey, travel.now, p.legIndex).some(t => t.status === 'missed'));
  const timing = onboardTiming(active, uncertain ? Number.MAX_SAFE_INTEGER : travel.now);
  const choices = Array.from(new Map([...(leg?.calls?.filter(c => c.alighting).map(c => c.place) ?? []), ...(leg ? [leg.to] : [])].map(place => [place.quayId ?? place.id ?? place.name, place])).values());
  const allAlerts = [...travel.alerts, ...(travel.error ? [{id:'error',kind:'warning' as const,title:'Oppdatering fra reiseassistenten',detail:travel.error}] : [])].sort((a,b)=>({danger:0,warning:1,info:2}[a.kind]-{danger:0,warning:1,info:2}[b.kind]) || (Number(!a.id.startsWith('tight:'))-Number(!b.id.startsWith('tight:'))));
  const topAlert = allAlerts[0];
  const sheet = travel.choosingAlight ? 'alight' : editingStops ? 'stops' : travel.walkingChoice ? 'walk' : panel;
  const shortAlert = topAlert && <View accessibilityRole="alert" style={{gap:4,padding:10,backgroundColor:topAlert.kind==='danger'?colors.redBg:colors.amberBg,borderRadius:10}}><Text style={[s.text,{fontWeight:'600'}]}>{topAlert.id==='error'?topAlert.detail:topAlert.title}</Text><Button small secondary label={allAlerts.length>1?`Se alle varsler (${allAlerts.length})`:'Se varsel'} onPress={()=>setPanel('alerts')}/></View>;
  const modalNotice = topAlert && sheet!=='alerts' ? <Text accessibilityRole="alert" style={[s.text,{color:colors.red}]}>{topAlert.id==='error'?topAlert.detail:topAlert.title}</Text> : recovery ? <Text accessibilityRole="alert" style={s.text}>Videreplan må oppdateres fra der du er.</Text> : undefined;
  const titles:Record<string,string>={options:'Endre reisen',journey:'Hele reisen',alerts:'Varsler',alternative:'Alternativ reise',alight:'Hvor gikk du av?',walk:'Gå resten',stops:'Endre stopp',continue:'Fortsett reisen',recovery:'Velg videre reise',demo:'Demo'};
  function closeSheet(){ travel.cancelAlighting();travel.cancelWalking();travel.cancelStopRoutes();setEditingStops(false);setPanel(null); }
  if (active.pendingRide) return <PendingRideScreen travel={travel} onBack={onBack} onDepartures={() => onDepartures(true)} />;
  return <>
  <ScrollView accessibilityElementsHidden={!!sheet} importantForAccessibility={sheet?"no-hide-descendants":"auto"} aria-hidden={!!sheet} onScroll={e=>setScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={100} contentContainerStyle={{padding:20,width:'100%',maxWidth:900,alignSelf:'center',gap:14}} keyboardShouldPersistTaps="handled">
   <View style={[s.row,{justifyContent:'space-between',flexWrap:'wrap'}]}><Button small secondary label="← Planlegg reise" onPress={onBack}/><Button small secondary label="Endre reisen" onPress={()=>setPanel('options')}/><SettingsButton/></View>
   <TravelStatus label={stay?'Opphold':recovery?'Videre reise':`Steg ${index+1} av ${steps.length} · ${step.kind==='walking'?'Til fots':step.label}`} action={stay?`Opphold ved ${stay.place.name}`:recovery?'Må oppdateres fra der du er':step.action}>
    {!stay && !recovery && leg && <View style={s.row}><TransportIcon mode={leg.mode}/><Text style={[s.text,{flexShrink:1}]}>{step.at?`${step.kind==='waiting'?'Avgang':step.kind==='onboard'?'Avstigning':'Forventet fremme'} ${clock(step.at)}`:''}{uncertainTime?' · usikker tid':''}</Text></View>}
    {!stay && !recovery && timing && <Text style={s.muted}>{timing.includes('Usikker')?timing:timing.slice(timing.indexOf('–')+1).trim()}</Text>}
    {stay ? <Button label={travel.stopBusy?'Finner videre reiser …':'Klar til å fortsette'} disabled={travel.stopBusy} onPress={()=>{setPanel('continue');void travel.findStopRoutes(active.stops??[],true);}}/> : recovery ? <>
     <Text style={s.text}>{p.place?`Videre fra ${p.place.name}`:'Bekreft hvor du gikk av.'}</Text>
     <Button label={travel.recovery.length?'Se videreforslag':p.place?'Prøv igjen':'Velg avstigningssted'} disabled={travel.busy} onPress={()=>{if(!p.place)travel.editAlightingPlace();else {setPanel('recovery');if(!travel.recovery.length)void travel.refresh();}}}/>
    </> : p.step==='arrived' ? <Text style={s.text}>Reisen er fullført.</Text> : p.phase==='onboard' ? <Button label={travel.locatingAlight?'Henter avstigningssted …':'Jeg har gått av'} disabled={travel.locatingAlight} onPress={()=>void travel.confirmAlight()}/> : nextBus ? <Button label={step.kind==='walking'?'Jeg er på holdeplassen':'Jeg er om bord'} onPress={step.kind==='walking'?travel.confirmStop:travel.confirmBoard}/> : <Button label="Jeg er fremme" onPress={travel.finish}/>}
    {!stay && !recovery && <Text style={s.text}>{broken?'Ankomst er usikker':`${uncertainArrival?'Usikker ankomst':'Fremme'} ved ${pause?.place.name??active.destination.name} ca. ${clock(arrival(active.journey))}`}</Text>}
    {pause && <Text style={s.muted}>Sluttankomst beregnes når du fortsetter.</Text>}
    {(travel.paused || !travel.ready) && !stay && <Text style={s.muted}>{travel.paused?'Overvåking pauset · tidene er usikre':'Oppdaterer reisen …'}</Text>}
   </TravelStatus>
   {!sheet && shortAlert}
       {travel.alighting && !travel.choosingAlight && <View accessibilityRole="alert" style={[s.card, { gap: 12 }]}><Text style={s.title}>Har du gått av her?</Text><Text style={s.text}>{travel.alighting.place.name}</Text><Text style={s.muted}>Bevegelsen din tyder på avstigning. Bekreft før vi oppdaterer reisen.</Text><Button label="Ja, jeg har gått av" onPress={travel.acceptAlighting} /><Button secondary label="Nei, jeg er fortsatt om bord" onPress={travel.dismissAlighting} /></View>}
    {travel.boarding && <View accessibilityRole="alert" style={[s.card, { gap: 10 }]}><Text style={s.text}>Vi tror du er på {nextBus ? vehicleName(nextBus) : 'avgangen'} – stemmer det?</Text><Button label="Ja, jeg er om bord" onPress={travel.confirmBoard} /><Button secondary label="Nei, ikke denne avgangen" onPress={travel.dismissBoarding} /></View>}
    {travel.boardingUndo && <View style={[s.card, { gap: 10 }]}><Text style={s.muted}>Påstigning registrert automatisk ut fra bevegelsen din og avgangens tider. GPS kan ta feil.</Text><Button secondary label="Angre påstigning" onPress={travel.undoBoarding} /></View>}

   {!stay && !editingStops && pending[0] && <Button small secondary label={pending[0].mode==='pause'?`Jeg er ved ${pending[0].place.name} – start opphold`:`Bekreft passert ${pending[0].place.name}`} onPress={()=>travel.confirmPlannedStop(pending[0].id)}/>}
   <View style={{gap:6}}><JourneyStrip active={active} now={travel.now} uncertain={uncertain} onPress={()=>{setShowCompleted(false);setPanel("journey");}}/><Button secondary label="Se hele reisen →" onPress={()=>{setShowCompleted(false);setPanel('journey');}}/></View>
   {!stay && !recovery && travel.recommendation && <View testID="recommendation" style={{gap:8}}><Text style={s.text}>{travel.recommendation.reason}</Text><Button secondary label="Se alternativ" onPress={()=>setPanel('alternative')}/></View>}
   {!stay && !recovery && p.step==='waiting' && nextBus && <View onLayout={e=>setBoardBox(e.nativeEvent.layout)}><DepartureBoard compact place={nextBus.from} demo={travel.demo} visible={!sheet && !settings.opened && scrollY<boardBox.y+boardBox.height && scrollY+height>boardBox.y} selectedId={`${nextBus.serviceJourneyId}@${nextBus.serviceDate}`} notice={modalNotice??shortAlert} onMore={()=>onDepartures(false,undefined,nextBus.from)} onSelect={(d,onboard)=>onDepartures(onboard,d,nextBus.from)}/></View>}
  </ScrollView>
  {sheet && <DetailSheet title={titles[sheet]??'Reisedetaljer'} onClose={closeSheet} notice={modalNotice}>
       {sheet === "options" && <View style={[s.card, { gap: 16 }]}><Text style={s.text}>{active.origin.name} → {active.destination.name}</Text><Button secondary label="Endre stopp" onPress={() => { setDraftStops(active.stops ?? []); setEditingStops(true);setPanel("stops"); travel.cancelStopRoutes(); }} /><Button secondary label="Avslutt og start på nytt" onPress={() => { travel.stop(); onBack(); }} /></View>}

   {sheet==='options' && <>
    {!stay && <Button secondary label="Oppdater nå" disabled={travel.busy} onPress={()=>void travel.refresh()}/>}
    <Text style={s.muted}>Reisedata oppdatert {clock(active.journey.fetchedAt)}</Text>
    {travel.resumed && !stay && <Text style={s.muted}>Overvåkingen kan ha vært pauset mens siden var inaktiv.</Text>}
    {!stay && p.phase!=='onboard' && (p.step!=='arrived'||recovery) && !active.walkingOnly && <Button secondary label={travel.walkingBusy?'Beregner gangrute …':'Jeg vil gå resten'} disabled={travel.walkingBusy} onPress={()=>void travel.requestWalking()}/>}
    <Button secondary label="Jeg er på en annen avgang" onPress={()=>{setPanel(null);onDepartures(true);}}/>
    {recovery && <Button secondary label="Endre startsted" onPress={travel.editAlightingPlace}/>}
    {travel.demo && <Button secondary label="Demo · simuler hendelse" onPress={()=>setPanel('demo')}/>}
   </>}
   {sheet==='journey' && <>
    <Text style={s.text}>{active.origin.name} → {active.destination.name}</Text>
    {recovery && <Text style={s.text}>Tidligere plan · tider og overganger gjelder ikke.</Text>}
    {steps.slice(index).map((item,i)=><View key={`${item.kind}:${item.legIndex}`} style={[s.card,{padding:14,gap:6,borderColor:i===0?colors.green:colors.border}]}><Text style={s.label}>{i===0?'Nå':'Senere'} · Steg {index+i+1}</Text><Text style={s.text}>{item.label}</Text>{item.at && !recovery && <Text style={s.muted}>{clock(item.at)}{uncertain?' · sist kjent tid':''}</Text>}</View>)}
    {(active.stops??[]).length>0 && <View style={{gap:8}}><Text style={s.title}>Planlagte stopp</Text>{(active.stops??[]).map(stop=><Text key={stop.id} style={s.text}>{stop.visited?'✓ Besøkt':'Senere'} · {stop.place.name} · {stop.mode==='pause'?'Opphold':'Direkte videre'}</Text>)}</View>}
    {!recovery && <><Text style={s.title}>Tider og overganger</Text><Timeline journey={{...active.journey,legs:active.journey.legs.slice(p.legIndex)}} now={uncertain?Number.MAX_SAFE_INTEGER:travel.now}/></>}
    {index>0 && <Button secondary label={showCompleted?'Skjul fullførte steg':`Vis fullførte steg (${index})`} onPress={()=>setShowCompleted(!showCompleted)}/>}
    {showCompleted && steps.slice(0,index).map((item,i)=><Text key={i} style={s.muted}>✓ Fullført · {item.label}</Text>)}
   </>}
   {sheet==='alerts' && allAlerts.map(a=><AlertCard key={a.id} alert={a}/>)}
   {sheet==='alternative' && <>    {!stay && !editingStops && !recovery && travel.recommendation && <View testID="recommendation-detail" style={[s.card, { gap: 14, borderColor: colors.green }]}><Text style={s.title}>{travel.recommendation.reason}</Text><JourneyCard journey={travel.recommendation.journey} now={travel.now} compact /><Button label="Bytt til denne reisen →" onPress={()=>{travel.acceptAlternative();setPanel(null);}} /></View>}
{!travel.recommendation && <Text style={s.text}>Alternativet er ikke lenger aktuelt.</Text>}</>}
       {(sheet === "continue" || sheet === "stops") && <View style={[s.card, { gap: 14 }]}>
      <Text style={s.title}>{editingStops ? 'Endre planlagte stopp' : `Opphold ved ${stay?.place.name}`}</Text>
      {editingStops && <StopEditor value={draftStops} onChange={stops => { setDraftStops(stops); travel.cancelStopRoutes(); }} demo={travel.demo} />}
      {stay && <Text style={s.text}>Reisen er pauset. Ny rute beregnes fra der du er når du er klar.</Text>}
      <Button label={travel.stopBusy ? 'Finner videre reiser …' : editingStops ? 'Finn reise med disse stoppene' : 'Klar til å fortsette'} disabled={travel.stopBusy} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], !!stay)} />
      {(travel.resumePlace || stay) && <>{travel.demo && <Button secondary label="Jeg har gått til Studentersamfundet" onPress={() => { setContinuationPlace(DEMO_WRONG_STOP); travel.cancelStopRoutes(); }} />}<Text style={s.muted}>Velg startsted hvis GPS ikke er tilgjengelig, eller du vil velge selv.</Text><PlaceField label="Hvor er du nå?" value={continuationPlace} onChange={p => { setContinuationPlace(p); travel.cancelStopRoutes(); }} demo={travel.demo} /><Button secondary label="Fortsett fra valgt sted" disabled={!continuationPlace} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], true, continuationPlace)} />{stay?.continuationFrom && <Button secondary label={`Prøv igjen fra ${stay.continuationFrom.name}`} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], true, stay.continuationFrom)} />}{stay && <Button secondary label={`Jeg er fortsatt ved ${stay.place.name}`} onPress={() => void travel.findStopRoutes(editingStops ? draftStops : active.stops ?? [], true, stay.place)} />}</>}
      {travel.stopChoices.map((choice, i) => <View key={i} testID="stop-route" style={{ gap: 12 }}><Text style={s.text}>Videre fra {choice.active.origin.name}</Text><JourneyCard journey={choice.journey} now={travel.now} compact /><Button label="Velg denne videre reisen" onPress={() => { travel.acceptStopRoute(choice); setEditingStops(false);setPanel(null); }} /></View>)}
      {editingStops && <Button secondary label="Avbryt endring" onPress={() => { setEditingStops(false);setPanel("options"); travel.cancelStopRoutes(); }} />}
    </View>}

       {travel.walkingChoice && <View testID="walking-choice" style={[s.card, { gap: 14 }]}><Text style={s.title}>Gå resten av reisen</Text><Text style={s.text}>Fra {travel.walkingChoice.legs[0].from.name} · {Math.round(travel.walkingChoice.legs.reduce((sum, l) => sum + l.distance, 0))} meter</Text><JourneyCard journey={travel.walkingChoice} now={travel.now} compact /><Text style={s.muted}>Den valgte reisen beholdes til du bekrefter.</Text><Button label="Jeg går denne veien" onPress={()=>{travel.acceptWalking();setPanel(null);}} /><Button secondary label="Behold reisen" onPress={closeSheet} /></View>}

       {travel.choosingAlight && <View style={[s.card, { gap: 14 }]}><Text style={s.muted}>Velg faktisk sted. Planlagt stopp er bare et forslag.</Text>
      {p.phase === 'onboard' && choices.map(place => <Button key={place.quayId ?? place.id ?? place.name} secondary label={`Jeg gikk av på ${place.name}`} onPress={() => {travel.chooseAlightingPlace(place);setPanel(null);}} />)}
      {travel.demo && <Button secondary label={`Jeg gikk av på ${DEMO_WRONG_STOP.name}`} onPress={() => {travel.chooseAlightingPlace(DEMO_WRONG_STOP);setPanel(null);}} />}
      {!travel.demo && <><PlaceField label="Søk etter avstigningssted" value={selectedPlace} onChange={setSelectedPlace} demo={false} /><Button label="Bruk dette stedet" disabled={!selectedPlace} onPress={() => {if(selectedPlace){travel.chooseAlightingPlace(selectedPlace);setPanel(null);}}} /></>}
      <Button small secondary label="Avbryt" onPress={closeSheet} />
    </View>}

       {sheet === "recovery" && recovery && travel.recovery.map((j, i) => <View key={j.id || i} testID="recovery-option" style={[s.card, { gap: 14 }]}><Text style={s.title}>Videre fra {p.place?.name}</Text><JourneyCard journey={j} now={travel.now} compact /><Button label="Velg denne videre reisen" onPress={() => {travel.acceptRecovery(j);setPanel(null);}} /></View>)}

   {sheet==='recovery' && <><Button secondary label="Prøv igjen" disabled={travel.busy} onPress={()=>void travel.refresh()}/><Button secondary label="Endre startsted" onPress={travel.editAlightingPlace}/></>}
       {sheet === "demo" && travel.demo && <View style={[s.card, { gap: 12 }]}><Text style={s.title}>Demo · simulerte hendelser</Text><View style={[s.row, { flexWrap: 'wrap' }]}>{SCENARIOS.map(scenario => <Button small key={scenario.id} secondary={travel.scenario !== scenario.id} label={scenario.label} onPress={() => {travel.changeScenario(scenario.id);setPanel(null);}} />)}</View><Text style={s.muted}>Prøv «Jeg har gått av» og velg et annet stopp for å teste ny videre reise.</Text></View>}

  </DetailSheet>}
 </>;
}
