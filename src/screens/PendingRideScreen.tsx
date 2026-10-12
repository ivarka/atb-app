import { JourneyStrip } from '../ui/JourneyStrip';
import { SettingsButton } from '../ui/Settings';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Travel } from './PlanningScreen';
import { Place } from '../domain/types';
import { upcomingPosition } from '../domain/departures';
import { Button, clock, JourneyCard, PlaceField, TransportIcon } from '../ui/components';
import { DetailSheet } from '../ui/DetailSheet';
import { TravelStatus } from '../ui/TravelStatus';
import { s } from '../ui/theme';
export function PendingRideScreen({ travel,onBack,onDepartures }: { travel: Travel; onBack:()=>void; onDepartures:()=>void }) {
 const active=travel.active!, ride=active.pendingRide!, leg=active.journey.legs[0];
 const [place,setPlace]=useState<Place>(), [panel,setPanel]=useState<string>();
 const next=upcomingPosition(ride,leg.calls ?? [],travel.now,leg.checkedAt,travel.position);
 const sheet=travel.choosingAlight?'alight':panel;
 const close=()=>{travel.cancelAlighting();setPanel(undefined);};
 const titles:Record<string,string>={options:'Endre reisen',next:'Velg neste stopp',routes:'Velg videreplan',journey:'Hele reisen',alight:'Hvor gikk du av?'};
 return <>
 <ScrollView contentContainerStyle={{padding:20,maxWidth:900,width:'100%',alignSelf:'center',gap:14}} keyboardShouldPersistTaps="handled">
  <View style={[s.row,{justifyContent:'space-between',flexWrap:'wrap'}]}><Button small secondary label="← Planlegg reise" onPress={onBack}/><Button small secondary label="Endre reisen" onPress={()=>setPanel('options')}/><SettingsButton/></View>
  <TravelStatus label="Bekreftet påstigning" action={`Om bord på ${ride.departure.line} mot ${ride.departure.headsign}`}>
   <View style={s.row}><TransportIcon mode={ride.departure.mode}/><Text style={s.text}>Til {active.destination.name}</Text></View>
   <Text style={s.text}>Videreplan må beregnes · ankomst er ukjent.</Text>
   {next!==undefined && <Text style={s.muted}>Neste bekreftede stopp: {leg.calls?.find(c=>c.position===next)?.place.name}</Text>}
   <Button label={next===undefined?'Velg neste stopp':'Se videreforslag'} onPress={()=>setPanel(next===undefined?'next':'routes')}/>
   {travel.paused && <Text style={s.muted}>Overvåking pauset · tidene er usikre</Text>}
  </TravelStatus>
  {!!travel.error && <Text accessibilityRole="alert" style={s.text}>{travel.error}</Text>}
  <JourneyStrip active={active} now={travel.now} uncertain={!travel.ready||travel.paused} onPress={()=>setPanel("journey")}/>
  <Button secondary label="Se hele reisen →" onPress={()=>setPanel('journey')}/>
 </ScrollView>
 {sheet && <DetailSheet title={titles[sheet]} onClose={close} notice={<Text accessibilityRole="alert" style={s.text}>{travel.error || 'Videreplan må beregnes · ankomst er ukjent.'}</Text>}>
  {sheet==='options' && <>
   <Button secondary label="Oppdater nå" disabled={travel.busy||travel.paused} onPress={()=>void travel.refresh()}/>
   <Text style={s.muted}>Reisedata oppdatert {clock(leg.checkedAt)}</Text>
   <Button secondary label="Endre neste stopp" onPress={()=>setPanel('next')}/>
   <Button secondary label="Jeg har gått av" disabled={travel.locatingAlight} onPress={()=>void travel.confirmAlight()}/>
   <Button secondary label="Jeg er på en annen avgang" onPress={()=>{setPanel(undefined);onDepartures();}}/>
   <Button secondary label="Avslutt og start på nytt" onPress={()=>{travel.stop();onBack();}}/>
  </>}
  {sheet==='next' && <>
   <Text style={s.text}>Velg neste stopp på avgangen du sitter på. Klokken alene bekrefter ikke hvor langt du har kommet.</Text>
   {(leg.calls??[]).filter(c=>c.position>ride.departure.position&&!c.actualDeparture&&!c.cancelled&&(next===undefined||c.position>=next)).map(c=><Button key={c.position} secondary label={`Neste stopp er ${c.place.name}`} onPress={()=>{travel.confirmNextCall(c.position);setPanel('routes');}}/>)}
   {!leg.calls?.length && <Button label="Prøv igjen" disabled={travel.busy||travel.paused} onPress={()=>void travel.refresh()}/>}
  </>}
  {sheet==='routes' && <>
   <Text style={s.muted}>Beregnede alternativer fra opptil tre kommende avstigningssteder.</Text>
   {travel.rideChoices.map(j=><View key={j.id} testID="ride-option" style={{gap:12}}><JourneyCard journey={j} now={travel.now} compact/><Button label="Følg denne videreplanen" onPress={()=>{travel.acceptRide(j);setPanel(undefined);}}/></View>)}
   {next===undefined && <Button label="Velg neste stopp" onPress={()=>setPanel('next')}/>}
   <Button secondary label={travel.busy?'Beregner videreplan …':travel.rideChoices.length?'Oppdater videreforslag':'Prøv igjen'} disabled={travel.busy||travel.paused} onPress={()=>void travel.refresh()}/>
  </>}
  {sheet==='journey' && <>
   <Text style={s.text}>Om bord på {ride.departure.line} mot {ride.departure.headsign} · fra {ride.departure.place.name}</Text>
   <Text style={s.text}>Reisemål: {active.destination.name}</Text>
   {(active.stops??[]).map(stop=><Text key={stop.id} style={s.text}>{stop.visited?'✓ Besøkt':'Senere'} · {stop.place.name} · {stop.mode==='pause'?'Opphold':'Direkte videre'}</Text>)}
   <Text style={s.muted}>Videreplanen er ikke valgt. Gamle tider og overganger gjelder ikke.</Text>
  </>}
  {sheet==='alight' && <>
   <Text style={s.text}>Velg faktisk avstigningssted.</Text>
   {leg.calls?.filter(c=>c.alighting).map(c=><Button key={c.position} secondary label={`Jeg gikk av på ${c.place.name}`} onPress={()=>{travel.chooseAlightingPlace(c.place);setPanel(undefined);}}/>)}
   <PlaceField label="Søk etter avstigningssted" value={place} onChange={setPlace} demo={travel.demo}/>
   <Button label="Bruk dette stedet" disabled={!place} onPress={()=>{if(place){travel.chooseAlightingPlace(place);setPanel(undefined);}}}/>
   <Button secondary label="Avbryt" onPress={close}/>
  </>}
 </DetailSheet>}
 </>;
}
