import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Travel } from './PlanningScreen';
import { Place } from '../domain/types';
import { upcomingPosition } from '../domain/departures';
import { Button, clock, JourneyCard, PlaceField, TransportIcon } from '../ui/components';
import { s } from '../ui/theme';
export function PendingRideScreen({ travel,onBack,onDepartures }: { travel: Travel; onBack:()=>void; onDepartures:()=>void }) {
 const active=travel.active!, ride=active.pendingRide!, leg=active.journey.legs[0];
 const [place,setPlace]=useState<Place>();
 const [showStops,setShowStops]=useState(false);
 const next=upcomingPosition(ride,leg.calls ?? [],travel.now,leg.checkedAt,travel.position);
 return <ScrollView contentContainerStyle={{padding:20,maxWidth:900,width:'100%',alignSelf:'center',gap:16}} keyboardShouldPersistTaps="handled">
  <Button secondary label="← Planlegg reise" onPress={onBack} />
  <View style={[s.card,{gap:12}]}><Text style={s.label}>Bekreftet påstigning</Text><TransportIcon mode={ride.departure.mode} /><Text style={s.title}>Om bord på {ride.departure.line} mot {ride.departure.headsign}</Text><Text style={s.text}>Til {active.destination.name}</Text><Text style={s.text}>Videreplan må beregnes. Tidligere ankomst og overganger gjelder ikke.</Text>
  {next===undefined ? <Text style={s.text}>Vi vet ikke sikkert hvor langt du har kommet. Velg neste stopp.</Text> : <Text style={s.text}>Neste bekreftede stopp: {leg.calls?.find(c=>c.position===next)?.place.name}</Text>}
  <Text style={s.muted}>Reisedata oppdatert {clock(leg.checkedAt)}</Text>
  {next!==undefined && <Button small secondary label={showStops ? 'Lukk stoppvalg' : 'Endre neste stopp'} onPress={()=>setShowStops(!showStops)} />}
  {(next===undefined || showStops) && <ScrollView style={{maxHeight:240}} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:8}}>{(leg.calls ?? []).filter(c=>c.position>ride.departure.position && !c.actualDeparture && !c.cancelled && (next===undefined || c.position>=next)).map(c=><Button key={c.position} small secondary label={`Neste stopp er ${c.place.name}`} onPress={()=>{setShowStops(false);travel.confirmNextCall(c.position);}} />)}</ScrollView>}
  <Button label={travel.busy ? 'Beregner videreplan …' : travel.rideChoices.length ? 'Oppdater videreforslag' : 'Prøv igjen'} disabled={travel.busy || travel.paused} onPress={()=>void travel.refresh()} />
  </View>
  {travel.choosingAlight && <View style={[s.card,{gap:12}]}><Text style={s.title}>Hvor gikk du av?</Text>{leg.calls?.filter(c=>c.alighting).map(c=><Button key={c.position} secondary label={`Jeg gikk av på ${c.place.name}`} onPress={()=>travel.chooseAlightingPlace(c.place)} />)}<PlaceField label="Søk etter avstigningssted" value={place} onChange={setPlace} demo={travel.demo} /><Button label="Bruk dette stedet" disabled={!place} onPress={()=>place && travel.chooseAlightingPlace(place)} /><Button secondary label="Avbryt" onPress={travel.cancelAlighting} /></View>}
  {!!travel.error && <Text accessibilityRole="alert" style={s.text}>{travel.error}</Text>}
  {travel.rideChoices.length>0 && <Text style={s.muted}>Beregnede alternativer fra opptil tre kommende avstigningssteder. Velg videreplanen du vil følge.</Text>}
  {travel.rideChoices.map(j=><View key={j.id} testID="ride-option" style={[s.card,{gap:12}]}><JourneyCard journey={j} now={travel.now} compact /><Button label="Følg denne videreplanen" onPress={()=>travel.acceptRide(j)} /></View>)}
  <Button secondary label="Jeg har gått av" disabled={travel.locatingAlight} onPress={()=>void travel.confirmAlight()} />
  <Button secondary label="Jeg er på en annen avgang" onPress={onDepartures} />
  <Button secondary label="Avslutt og start på nytt" onPress={()=>{travel.stop();onBack();}} />
 </ScrollView>;
}
