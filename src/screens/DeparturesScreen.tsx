import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { departureCalls, nearbyStops } from '../api/departures';
import { entur } from '../api/entur';
import { demoDepartureCalls, DEMO_STATION } from '../demo/departures';
import { DEMO_TO, demoProvider } from '../demo/provider';
import { Departure, Journey, Place } from '../domain/types';
import { routesWithDeparture } from '../domain/departures';
import { rememberPlaces } from '../platform/recentPlaces';
import { locate } from '../platform/location';
import { isForeground, onVisibilityChange } from '../platform/visibility';
import { DepartureBoard } from '../ui/DepartureBoard';
import { Button, clock, JourneyCard, PlaceField } from '../ui/components';
import { s } from '../ui/theme';
import { Travel } from './PlanningScreen';
export function DeparturesScreen({ travel, onBack, onOpenActive, initialPlace, initialDeparture, alreadyOnboard = false }: { travel: Travel; onBack: () => void; onOpenActive: () => void; initialPlace?: Place; initialDeparture?: Departure; alreadyOnboard?: boolean }) {
 const [place,setPlace] = useState(initialPlace ?? (travel.demo ? DEMO_STATION : undefined));
 const [target,setTarget] = useState(travel.active?.destination ?? (travel.demo ? DEMO_TO : undefined));
 const [lookback,setLookback] = useState(alreadyOnboard ? 30 : 0);
 const [selection,setSelection] = useState(initialDeparture ? { departure: initialDeparture, onboard: alreadyOnboard } : undefined);
 const [nearby,setNearby] = useState<Place[]>([]), [routes,setRoutes] = useState<Journey[]>([]);
 const [busy,setBusy] = useState(false), [error,setError] = useState('');
 const [scrollY,setScrollY] = useState(0), [boardBox,setBoardBox] = useState({y:0,height:1});
 const height = useWindowDimensions().height;
 const version = useRef(0);
 function invalidate() { version.current++; setBusy(false); setRoutes([]); setError(''); }
 useEffect(() => { invalidate(); return () => { version.current++; }; },[travel.active?.startedAt,travel.active?.progress,travel.preference]);
 useEffect(() => onVisibilityChange(() => { if (!isForeground()) invalidate(); }),[]);
 async function nearbyPlaces() {
  invalidate(); const id=version.current; setBusy(true);
  try { const p=await locate(); if(id!==version.current)return; const stops=await nearbyStops(p.place); if(id===version.current) {setNearby(stops); if(!stops.length)setError('Ingen holdeplasser innen 800 meter. Søk etter holdeplassen.');} }
  catch(e) {if(id===version.current)setError((e as Error).message);} finally {if(id===version.current)setBusy(false);}
 }
 async function plan() {
  if(!selection || !target)return;
  invalidate(); const id=version.current, d=selection.departure; setBusy(true);
  try {
   if(d.cancelled || Date.now()-d.checkedAt>=90000)throw new Error('Avgangen må oppdateres før du velger den.');
   const calls=travel.demo ? demoDepartureCalls(d) : await departureCalls(d);
   if(id!==version.current)return;
   if(!travel.demo)rememberPlaces([target,d.place]);
   const list=await routesWithDeparture(d,calls,d.position+1,target,travel.active?.stops ?? [],travel.preference,travel.demo ? demoProvider(Date.now(),travel.scenario) : entur,false,undefined,()=>id===version.current && isForeground());
   if(id===version.current){setRoutes(list);if(!list.length)setError('Ingen gjennomførbar videre reise med denne avgangen. Velg en annen.');}
  }catch(e){if(id===version.current)setError((e as Error).message);}finally{if(id===version.current)setBusy(false);}
 }
 return <ScrollView onScroll={e=>setScrollY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={100} contentContainerStyle={{padding:20,maxWidth:900,width:'100%',alignSelf:'center',gap:16}} keyboardShouldPersistTaps="handled">
  <Button secondary label="← Tilbake" onPress={onBack} />
  <Text style={s.title}>{lookback ? 'Hvilken avgang er du på?' : 'Avganger'}</Text>
  {!selection && <>
   <PlaceField label={lookback ? 'Hvor gikk du på?' : 'Holdeplass'} value={place} onChange={p=>{invalidate();setPlace(p);}} demo={travel.demo} stopsOnly />
   {!travel.demo && <Button secondary label="Finn holdeplasser nær meg" disabled={busy} onPress={()=>void nearbyPlaces()} />}
   {nearby.map(p=><Button key={p.id} secondary label={`Velg ${p.name}`} onPress={()=>{invalidate();setPlace(p);setNearby([]);}} />)}
   <View style={[s.row,{flexWrap:'wrap'}]}><Button secondary={lookback!==0} label="Neste avganger" onPress={()=>{invalidate();setLookback(0);}} /><Button secondary={lookback===0} label="Jeg er allerede om bord" onPress={()=>{invalidate();setLookback(30);}} /></View>
   {lookback>0 && <Button small secondary label={`Vis siste ${lookback+30} minutter`} disabled={lookback>=180} onPress={()=>{invalidate();setLookback(lookback+30);}} />}
   {place && <View onLayout={e=>setBoardBox(e.nativeEvent.layout)}><DepartureBoard allowPlan={travel.active?.progress.phase!=="onboard"} place={place} demo={travel.demo} lookback={lookback} visible={scrollY<boardBox.y+boardBox.height && scrollY+height>boardBox.y} onSelect={(departure,onboard)=>{invalidate();setSelection({departure,onboard});}} /></View>}
  </>}
  {selection && <View style={[s.card,{gap:14}]}>
   <Text style={s.title}>{selection.departure.line} mot {selection.departure.headsign}</Text>
   <Text style={s.text}>Fra {selection.departure.place.name} · {clock(selection.departure.expected)} · {selection.departure.serviceDate}{selection.departure.place.platform ? ` · plattform/kai ${selection.departure.place.platform}` : ''}</Text>
   {travel.active ? <Text style={s.text}>Til {target?.name} · gjenstående mellomstopp beholdes</Text> : <PlaceField label="Til – reisemål" value={target} onChange={p=>{invalidate();setTarget(p);}} demo={travel.demo} />}
   {selection.onboard ? <><Text style={s.muted}>Bekreft bare hvis du allerede er om bord. Videreplanen beregnes etterpå.</Text><Button label="Bekreft at jeg er om bord" disabled={!target} onPress={()=>{if(target && travel.boardDeparture(selection.departure,target))onOpenActive();}} /></> : <Button label={busy ? 'Beregner videre reise …' : 'Finn reise med denne avgangen'} disabled={!target || busy} onPress={()=>void plan()} />}
   <Button secondary label="Velg en annen avgang" onPress={()=>{invalidate();setSelection(undefined);}} />
  </View>}
  {!!error && <Text accessibilityRole="alert" style={s.text}>{error}</Text>}
  {!!travel.error && <Text accessibilityRole="alert" style={s.text}>{travel.error}</Text>}
  {routes.length>0 && <Text style={s.muted}>Beregnede alternativer fra opptil tre avstigningssteder.</Text>}
  {routes.map(j=><View key={j.id} style={[s.card,{gap:12}]}><JourneyCard journey={j} now={Date.now()} compact /><Button label="Velg denne reisen" onPress={()=>{if(target && travel.followDeparture(j,target))onOpenActive();}} /></View>)}
 </ScrollView>;
}
