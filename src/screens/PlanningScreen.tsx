import { StopEditor } from '../ui/StopEditor';
import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { namePosition } from '../api/entur';
import { DEMO_FROM, DEMO_TO } from '../demo/provider';
import { iso } from '../domain/journey';
import { Place, SearchRequest, PlannedStop } from '../domain/types';
import { locate } from '../platform/location';
import { useTravel } from '../state/useTravel';
import { AlertCard, Button, JourneyCard, PlaceField, Preferences, TransportIcon } from '../ui/components';
import DateField from '../ui/DateField';
import { colors, s } from '../ui/theme';
export type Travel = ReturnType<typeof useTravel>;
function localDate() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export function PlanningScreen({ travel, onOpenActive, onDepartures }: { travel: Travel; onOpenActive: () => void; onDepartures: (onboard: boolean) => void }) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const wide = useWindowDimensions().width >= 940;
  const [from, setFrom] = useState<Place | undefined>(travel.active?.origin ?? (travel.demo ? DEMO_FROM : undefined));
  const [to, setTo] = useState<Place | undefined>(travel.active?.destination ?? (travel.demo ? DEMO_TO : undefined));
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [date, setDate] = useState(localDate);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const locationVersion = useRef(0);
  const locationAbort = useRef<AbortController | null>(null);
  useEffect(() => () => { locationVersion.current++; locationAbort.current?.abort(); }, []);
  function changeFrom(p?: Place) { locationVersion.current++; locationAbort.current?.abort(); setLocating(false); setFrom(p); }
  const [request, setRequest] = useState<SearchRequest>();
  useEffect(() => { setRequest(undefined); travel.invalidateSearch(); }, [from, to, stops, when, date]);
  async function search() {
    if (!from || !to) { setError('Velg både fra- og tilsted fra søkeforslagene.'); return; }
    const at = when === 'now' ? Date.now() : new Date(date).getTime();
    if (!Number.isFinite(at) || at < Date.now() - 60000) { setError('Velg et gyldig avreisetidspunkt frem i tid.'); return; }
    setError(''); const req = { from, to, stops, at: iso(at) }; setRequest(req); await travel.search(req);
  }
  async function position() {
    const version = ++locationVersion.current;
    locationAbort.current?.abort();
    const controller = new AbortController(); locationAbort.current = controller;
    setLocating(true); setError('');
    try {
      const p = await locate();
      if (version !== locationVersion.current) return;
      const place = await namePosition(p.place, controller.signal);
      if (version !== locationVersion.current) return;
      travel.setPosition({ ...p, place }); setFrom(place);
      if (p.accuracy > 100) setError('Posisjonen er unøyaktig. Velg et sted manuelt.');
    } catch (e) { if (version === locationVersion.current) setError((e as Error).message); }
    finally { if (version === locationVersion.current) setLocating(false); }
  }
  function mode(demo: boolean) {
    locationVersion.current++; locationAbort.current?.abort(); setLocating(false); travel.changeMode(demo); setFrom(demo ? DEMO_FROM : undefined); setTo(demo ? DEMO_TO : undefined); setRequest(undefined); setStops([]);
  }
  return <ScrollView contentContainerStyle={{ padding: 20, width: '100%', maxWidth: 1192, alignSelf: 'center', gap: 16 }} keyboardShouldPersistTaps="handled">
    <Text style={[s.title, { fontSize: 30 }]}>underveis.</Text>
    <Text accessibilityRole="header" style={s.title}>Hvor vil du reise?</Text>
    <View style={[s.row, { flexWrap: "wrap" }]}><Button secondary label="Avganger" onPress={() => onDepartures(false)} /><Button secondary label="Jeg er allerede om bord" onPress={() => onDepartures(true)} /></View>
    {travel.active && <View style={[s.card, { gap: 12 }]}><Text style={s.text}>Du har en aktiv reise. Stopp og fremdrift er bevart.</Text><Button label="Til aktiv reise" onPress={onOpenActive} /><Button secondary label="Avslutt og start på nytt" onPress={travel.stop} /></View>}
    {!travel.active && <View style={s.row}><Button small label="Ekte reiser" secondary={travel.demo} onPress={() => mode(false)} /><Button small label="Prøv demo" secondary={!travel.demo} onPress={() => mode(true)} /></View>}
    {travel.demo && <Text style={s.muted}>Simulerte reiser · ingen ekte avganger</Text>}
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
      <View style={[s.card, { width: wide ? 365 : '100%', gap: 12 }]}>
        <PlaceField label="Fra" value={from} onChange={changeFrom} demo={travel.demo} onPosition={() => void position()} />
        {!travel.demo && <Button small secondary label={locating ? 'Henter posisjon …' : '⌖  Min posisjon'} disabled={locating} onPress={() => void position()} />}
        <PlaceField label="Til – reisemål" value={to} onChange={setTo} demo={travel.demo} />
        <StopEditor value={stops} onChange={setStops} demo={travel.demo} />
        <Text style={s.muted}>{when === "now" ? "Dra nå" : date.replace("T", " ")} · {travel.preference === "balanced" ? "Balansert" : travel.preference === "fastest" ? "Raskest" : "Tryggest"}</Text>
        <Button small secondary label="Reisevalg" onPress={() => setOptionsOpen(!optionsOpen)} />
        {optionsOpen && <>
        {!travel.demo && <><View style={s.row}><Button small label="Dra nå" secondary={when !== 'now'} onPress={() => setWhen('now')} /><Button small label="Velg tidspunkt" secondary={when !== 'later'} onPress={() => setWhen('later')} /></View>{when === 'later' && <DateField value={date} onChange={setDate} />}</>}
        <Preferences value={travel.preference} onChange={travel.changePreference} /></>}
        {!!error && <Text accessibilityRole="alert" style={s.text}>{error}</Text>}
        <Button label={travel.searching ? 'Finner reiser …' : 'Finn reiser  →'} disabled={travel.searching || !!travel.active} onPress={() => void search()} />
        <View style={[s.row, { flexWrap: 'wrap' }]}>{(['bus', 'water', 'tram', 'rail'] as const).map(mode => <TransportIcon key={mode} mode={mode} />)}</View><Text style={s.muted}>Buss, båt, trikk og tog · Trøndelag</Text>
      </View>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 16 }}>
        {!!travel.error && <AlertCard alert={{ id: 'error', kind: 'warning', title: 'Oppdatering fra reiseassistenten', detail: travel.error }} />}
        {travel.searching ? <ActivityIndicator color={colors.green} /> : travel.results.length > 0 && !travel.active ? <>
          <Text style={s.title}>Dine reiseforslag</Text>{request?.stops?.some(s => s.mode === "pause") && <Text style={s.text}>Til neste opphold. Sluttankomst beregnes når du fortsetter.</Text>}
          {travel.results.map((j, i) => <JourneyCard key={j.id} journey={j} now={travel.now} index={i} onFollow={() => { if (request) { travel.follow(j, request); onOpenActive(); } }} />)}
        </> : <View style={[s.card, { gap: 20 }]}><Text style={s.title}>Hele veien. Også når ting endrer seg.</Text><Text style={s.text}>Finn en reise, følg endringene og velg en bedre vei når du trenger det.</Text><Text style={s.muted}>Hold appen åpen og aktiv for løpende oppdateringer. Nye ruter tas i bruk først når du velger dem.</Text></View>}
      </View>
    </View>
    <Text style={s.muted}>Underveis · En uavhengig reiseassistent · Reisedata: Entur / AtB</Text>
  </ScrollView>;
}
