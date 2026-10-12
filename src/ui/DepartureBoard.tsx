import { boardPalettes, useSettings } from './Settings';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Departure, Place } from '../domain/types';
import { visibleDepartures } from '../domain/departureDisplay';
import { useDepartures } from '../state/useDepartures';
import { Button, clock, TransportIcon } from './components';
import { DetailSheet } from './DetailSheet';
import { s, colors } from './theme';

export function DepartureBoard({ place, demo, lookback = 0, visible = true, selectedId, onSelect, allowPlan = true, compact = false, onMore, notice }: { place: Place; demo: boolean; lookback?: number; visible?: boolean; selectedId?: string; allowPlan?: boolean; compact?: boolean; onMore?: () => void; notice?: React.ReactNode; onSelect: (d: Departure, onboard: boolean) => void }) {
 const {theme,opened}=useSettings();
 const palette=boardPalettes[theme];
 const data = useDepartures(place,lookback,demo,visible&&!opened);
 const [line,setLine] = useState<string>(), [selected,setSelected] = useState<string>();
 const [limit,setLimit] = useState(10), [now,setNow] = useState(Date.now());
 const {fontScale} = useWindowDimensions();
 useEffect(()=>{setLimit(10);setSelected(undefined);},[place.id,lookback,line]);
 useEffect(()=>{if(!visible)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[visible]);
 const filtered = data.rows.filter(d => !line || `${d.line}:${d.headsign}`===line);
 const rows = visibleDepartures(filtered,now,compact,lookback,limit);
 const departure = data.rows.find(d=>d.id===selected);
 const stale = (d:Departure) => !!data.error || data.paused || now-d.checkedAt>=90000;
 const nextOnly = compact && rows.length===1 && Date.parse(rows[0].expected)>now+300000;
 const quality = (d:Departure) => stale(d) ? 'Foreldet · usikker vurdering' : d.quality==='realtime' ? 'Sanntid' : 'Usikker tid';
 const choose = (d:Departure,onboard:boolean) => { if(stale(d)||d.cancelled)return;setSelected(undefined);onSelect(d,onboard); };
 return <View style={{gap:8,backgroundColor:palette.background,padding:10,borderRadius:12}} testID="departure-board">
  <Text style={[s.text,{fontWeight:'600',color:palette.text}]}>{compact ? 'Avganger neste 5 minutter' : lookback ? 'Velg avgangen du gikk på' : `Neste avganger fra ${place.name}`}</Text>
  {compact && <Text style={[s.muted,{color:palette.muted}]}>{place.name}</Text>}
  {lookback>0 && <><Text style={[s.muted,{color:palette.muted}]}>Fra {clock(now-lookback*60000)} · velg retning og tidspunkt</Text><Button small secondary label="Alle linjer og retninger" onPress={()=>setLine(undefined)} />{[...new Set(data.rows.map(d=>`${d.line}:${d.headsign}`))].map(key=><Button key={key} small secondary={line!==key} label={key.replace(':',' mot ')} onPress={()=>setLine(key)} />)}</>}
  {!!data.error && <Text accessibilityRole="alert" style={[s.muted,{color:palette.muted}]}>Kunne ikke oppdatere. Sist hentede avganger er usikre.</Text>}
  {data.paused && <Text style={[s.muted,{color:palette.muted}]}>Oppdatering pauset</Text>}
  {data.busy && !rows.length && <Text style={[s.muted,{color:palette.muted}]}>Henter avganger …</Text>}
  {!data.busy && !rows.length && <Text style={[s.muted,{color:palette.muted}]}>{lookback ? 'Ingen avganger i dette tidsrommet.' : 'Ingen avganger innen én time.'}</Text>}
  {nextOnly && <Text style={[s.muted,{color:palette.muted}]}>Neste avgang om {Math.ceil((Date.parse(rows[0].expected)-now)/60000)} min</Text>}
  <View style={[s.row,{gap:7}]}><Text style={{width:64,color:palette.muted,fontSize:12}}>Linje</Text><Text style={{flex:1,color:palette.muted,fontSize:12}}>Retning</Text><Text style={{width:90,textAlign:'right',color:palette.muted,fontSize:12}}>Avgang</Text></View>
  {rows.map(d=>{
   const chosen=selectedId===`${d.serviceJourneyId}@${d.serviceDate}`;
   const status=d.cancelled?'Innstilt':stale(d)||d.quality!=='realtime'?'Usikker tid':'';
   const minutes=Math.max(0,Math.ceil((Date.parse(d.expected)-now)/60000));
   const when=lookback ? clock(d.expected) : minutes===0?'Nå':`${minutes} min`;
   const label=`${d.line} mot ${d.headsign || 'Ukjent retning'}, ${when}${status ? `, ${status}`:''}${chosen?', Valgt reise':''}`;
   return <DepartureRow palette={palette} key={d.id} label={label} onPress={()=>setSelected(d.id)}>
    <View style={{width:64,flexDirection:"row",alignItems:"center",gap:3,flexWrap:"wrap"}}><TransportIcon mode={d.mode}/><Text style={[s.text,{fontWeight:"700",color:palette.text}]}>{chosen?"✓ ":""}{d.line}</Text></View>
    <Text numberOfLines={fontScale>1.2?undefined:1} style={[s.text,{flex:1,color:palette.text}]}>{d.headsign || 'Ukjent retning'}</Text>
    <Text style={[s.muted,{width:90,textAlign:'right',color:palette.text,fontVariant:['tabular-nums']}]}>{status ? `${status} · `:''}{when} ›</Text>
   </DepartureRow>;
  })}
  {compact ? <Button small secondary label="Se flere avganger →" onPress={()=>{setSelected(undefined);onMore?.();}} /> : <>
   {visibleDepartures(filtered,now,false,lookback,limit+1).length>limit && <Button small secondary label="Vis flere avganger" onPress={()=>setLimit(limit+10)} />}
   <Text style={[s.muted,{color:palette.muted}]}>{data.rows.length ? `Avganger oppdatert ${clock(data.rows[0].checkedAt)}`:''}</Text>
   <Button small secondary label="Oppdater avganger" disabled={data.busy} onPress={data.refresh}/>
  </>}
  {selected && <DetailSheet title="Avgangsdetaljer" onClose={()=>setSelected(undefined)} notice={notice}>
   {departure ? <>
    <View style={s.row}><TransportIcon mode={departure.mode}/><Text style={[s.title,{flexShrink:1}]}>{departure.line} mot {departure.headsign}</Text></View>
    <Text style={s.text}>Fra {departure.place.name}{departure.place.platform ? ` · plattform/kai ${departure.place.platform}`:''}</Text>
    <Text style={s.text}>Forventet {clock(departure.expected)} · rutetid {clock(departure.aimed)}</Text>
    <Text style={s.text}>{Math.max(0,Math.round((Date.parse(departure.expected)-Date.parse(departure.aimed))/60000))} min forsinket · {quality(departure)}</Text>
    <Text style={s.muted}>Driftsdato {departure.serviceDate} · reisedata oppdatert {clock(departure.checkedAt)}</Text>
    {departure.cancelled ? <Text accessibilityRole="alert" style={s.text}>Innstilt</Text> : <>
     {allowPlan && !departure.actual && Date.parse(departure.expected)>now && <Button label="Planlegg med denne" disabled={stale(departure)} onPress={()=>choose(departure,false)}/>}
     <Button secondary label="Jeg er om bord på denne" disabled={stale(departure)} onPress={()=>choose(departure,true)}/>
    </>}
   </> : <Text style={s.text}>Avgangen finnes ikke lenger i tavlen. Lukk og velg en oppdatert avgang.</Text>}
  </DetailSheet>}
 </View>;
}
function DepartureRow({label,onPress,children,palette}:{palette:typeof boardPalettes.light;label:string;onPress:()=>void;children:React.ReactNode}) {
 const [focus,setFocus]=useState(false);
 return <Pressable testID="departure-row" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)} style={[s.row,{minHeight:48,gap:7,paddingVertical:8,borderBottomWidth:1,borderColor:palette.border},focus&&{outlineWidth:3,outlineColor:palette.focus}]}>{children}</Pressable>;
}
