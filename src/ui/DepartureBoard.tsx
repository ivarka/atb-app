import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Departure, Place } from '../domain/types';
import { useDepartures } from '../state/useDepartures';
import { Button, clock, TransportIcon } from './components';
import { s, colors } from './theme';
export function DepartureBoard({ place, demo, lookback = 0, visible = true, selectedId, onSelect, allowPlan = true }: { place: Place; demo: boolean; lookback?: number; visible?: boolean; selectedId?: string; allowPlan?: boolean; onSelect: (d: Departure, onboard: boolean) => void }) {
 const data = useDepartures(place,lookback,demo,visible);
 const [line,setLine] = useState<string>();
 const [limit,setLimit] = useState(10);
 useEffect(()=>{setLimit(10);},[place.id,lookback,line]);
 const now = Date.now();
 const filtered = data.rows.filter(d => !line || `${d.line}:${d.headsign}` === line).filter(d => Date.parse(d.expected) >= now-lookback*60000);
 const ordered = lookback ? [...filtered.filter(d=>Date.parse(d.expected)<=now).reverse(),...filtered.filter(d=>Date.parse(d.expected)>now)] : filtered;
 const rows = ordered.slice(0,lookback ? limit : 10);
 return <View style={[s.card,{gap:12}]} testID="departure-board">
  <Text style={s.title}>{lookback ? 'Velg avgangen du gikk på' : `Neste avganger fra ${place.name}`}</Text>
  {lookback > 0 && <Text style={s.muted}>Fra {clock(now-lookback*60000)} · velg riktig retning og tidspunkt.</Text>}
  {lookback > 0 && <View style={{gap:6}}><Button small secondary label="Alle linjer og retninger" onPress={() => setLine(undefined)} />{[...new Set(data.rows.map(d => `${d.line}:${d.headsign}`))].map(key => <Button key={key} small secondary={line!==key} label={key.replace(':',' mot ')} onPress={() => setLine(key)} />)}</View>}
  {data.busy && <Text style={s.muted}>Henter avganger …</Text>}
  {!!data.error && <Text accessibilityRole="alert" style={s.text}>{data.error} Sist hentede avganger er usikre.</Text>}
  {data.paused && <Text style={s.muted}>Oppdatering pauset</Text>}
  {!data.busy && !rows.length && <Text style={s.text}>Ingen avganger funnet i dette tidsrommet.</Text>}
  {rows.map(d => {
   const stale = !!data.error || data.paused || now-d.checkedAt>=90000;
   const delay = Math.round((Date.parse(d.expected)-Date.parse(d.aimed))/60000);
   return <View key={d.id} testID="departure-row" style={{gap:8,paddingVertical:12,borderTopWidth:1,borderColor:colors.border}}>
    <View style={s.row}><TransportIcon mode={d.mode} /><Text style={[s.text,{fontWeight:'700',flex:1}]}>{d.line} mot {d.headsign || 'Ukjent retning'}</Text><Text style={s.text}>{clock(d.expected)}</Text></View>
    <Text style={s.muted}>{d.place.platform ? `Plattform/kai ${d.place.platform} · ` : ''}Rutetid {clock(d.aimed)} · {stale ? 'Foreldet · usikker vurdering' : d.quality === 'realtime' ? `Sanntid${delay>0 ? ` · ${delay} min forsinket` : ''}` : 'Rutetid · usikker vurdering'}</Text>
    {selectedId === `${d.serviceJourneyId}@${d.serviceDate}` && <Text style={s.text}>✓ Valgt reise</Text>}
    {d.cancelled ? <Text style={{color:colors.red}}>Innstilt</Text> : <View style={{gap:8}}>
     {allowPlan && !d.actual && Date.parse(d.expected)>now && <Button secondary label="Planlegg med denne" disabled={stale} onPress={() => onSelect(d,false)} />}
     <Button secondary label="Jeg er om bord på denne" disabled={stale} onPress={() => onSelect(d,true)} />
    </View>}
   </View>;
  })}
  {lookback>0 && ordered.length>limit && <Button secondary label="Vis flere avganger" onPress={()=>setLimit(limit+10)} />}
  {!!data.rows.length && <Text style={s.muted}>Avganger oppdatert {clock(data.rows[0].checkedAt)}</Text>}
  <Button small secondary label="Oppdater avganger" disabled={data.busy} onPress={data.refresh} />
 </View>;
}
