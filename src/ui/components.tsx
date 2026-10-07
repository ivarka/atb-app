import { useRecentPlaces, removeRecentPlace, clearRecentPlaces } from '../platform/recentPlaces';
import { transport, vehicleName } from '../domain/transport';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { autocomplete } from '../api/entur';
import { arrival, transitLegs, departure, isFresh, minutes, time, transfers } from '../domain/journey';
import { Journey, Place, Preference, TravelAlert, TransportMode } from '../domain/types';
import { colors, s } from './theme';

export function Button({ label, onPress, secondary, disabled, small, testID, accessibilityLabel }: { accessibilityLabel?: string; label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; small?: boolean; testID?: string }) {
  const [focused, setFocused] = useState(false);
  return <Pressable onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { minHeight: 44, justifyContent: "center" }, focused && { outlineWidth: 3, outlineColor: colors.green, outlineOffset: 2 }, secondary && styles.secondary, small && { paddingVertical: 9, paddingHorizontal: 14 }, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={{ color: secondary ? colors.ink : colors.white, fontSize: small ? 13 : 15, fontWeight: '600' }}>{label}</Text>
  </Pressable>;
}

const closePlaceLists = new Set<() => void>();
export function PlaceField({ label, value, onChange, demo, onPosition, stopsOnly = false, placeholder }: { label: string; value?: Place; onChange: (p?: Place) => void; demo: boolean; onPosition?: () => void; stopsOnly?: boolean; placeholder?: string }) {
  const [text, setText] = useState(value?.name ?? '');
  const [options, setOptions] = useState<Place[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const version = useRef(0), editing = useRef(false);
  const input = useRef<TextInput>(null);
  const recent = useRecentPlaces().map(r => r.place).filter(p => (!stopsOnly || p.id?.startsWith('NSR:StopPlace:')) && p.name.toLocaleLowerCase().includes(text.toLocaleLowerCase()));
  function choose(p?: Place) { version.current++; editing.current = false; setText(p?.name ?? ''); setOptions([]); setError(''); setFocused(false); onChange(p); }
  useEffect(() => { if (value) editing.current = false; if (value || !editing.current) { setText(value?.name ?? ''); setOptions([]); } }, [value]);
  useEffect(() => { const close = () => { version.current++; setFocused(false); setOptions([]); }; closePlaceLists.add(close); return () => { closePlaceLists.delete(close); }; }, []);
  useEffect(() => {
    if (demo || value || text.length < 2 || !focused) { setLoading(false); return; }
    const controller = new AbortController(); const id = ++version.current;
    setError('');
    const timer = setTimeout(() => {
      setLoading(true);
      autocomplete(text, controller.signal).then(list => {
        if (id !== version.current || controller.signal.aborted) return;
        const filtered = stopsOnly ? list.filter(p => p.id?.startsWith('NSR:StopPlace:')) : list;
        setOptions(filtered); setError(filtered.length ? '' : 'Ingen treff i Trøndelag. Prøv et mer presist navn.');
      }).catch(e => { if (id === version.current && !controller.signal.aborted) setError(e.message ?? 'Stedssøket feilet.'); }).finally(() => { if (id === version.current) setLoading(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); version.current++; };
  }, [text, value, focused, demo, stopsOnly]);
  return <View style={{ gap: 8 }}>
    <Text style={s.label}>{label}</Text>
    <View style={[styles.inputWrap, focused && { borderColor: colors.green, borderWidth: 2 }]}>
      <TextInput ref={input} accessibilityLabel={label} placeholder={placeholder ?? (label === 'Fra' ? 'Hvor reiser du fra?' : label.startsWith('Til') ? 'Hvor vil du ende reisen?' : 'Søk etter et sted')} placeholderTextColor={colors.muted} value={text} editable={!demo} onFocus={() => { closePlaceLists.forEach(close => close()); setFocused(true); }}
        onKeyPress={e => { if (e.nativeEvent.key === 'Escape') { version.current++; setFocused(false); setOptions([]); input.current?.blur(); } }}
        onChangeText={t => { version.current++; editing.current = true; setText(t); setOptions([]); onChange(undefined); setFocused(true); }} style={styles.input} />
      {loading && <ActivityIndicator size="small" color={colors.green} />}
      {!!text && !demo && <Button small secondary label="×" accessibilityLabel={`Tøm ${label}`} onPress={() => { choose(); setFocused(true); input.current?.focus(); }} />}
    </View>
    {focused && !demo && !value && <View style={styles.options}>
      {onPosition && !text && <Button secondary label="Min posisjon" onPress={() => { setFocused(false); onPosition(); }} />}
      {!!recent.length && <><Text style={[s.label, { padding: 12 }]}>Sist brukte steder</Text>{recent.map(p => <View key={p.id ?? `${p.latitude}:${p.longitude}`} style={[s.row, { padding: 6 }]}><View style={{ flex: 1 }}><Button secondary label={p.name} onPress={() => choose(p)} /></View><Button small secondary label="×" accessibilityLabel={`Fjern ${p.name} fra sist brukte`} onPress={() => removeRecentPlace(p)} /></View>)}<Button small secondary label="Tøm sist brukte steder" onPress={clearRecentPlaces} /></>}
      {!!options.length && <Text style={[s.label, { padding: 12 }]}>Søkeforslag</Text>}
      {options.map((p, i) => <Button key={`${p.id}-${i}`} secondary label={p.name} onPress={() => choose(p)} />)}
      {!text && !recent.length && <Text style={[s.muted, { padding: 12 }]}>Steder du bruker i reisesøk vil vises her.</Text>}
      <Button small secondary label="Lukk stedsliste" onPress={() => { version.current++; setFocused(false); setOptions([]); input.current?.blur(); }} />
    </View>}
    {!!error && <Text accessibilityRole="alert" style={[s.muted, { color: colors.amber }]}>{error}</Text>}
  </View>;
}

export const preferenceLabels: Record<Preference, string> = { balanced: 'Balansert', fastest: 'Raskest', safest: 'Tryggest' };
export function Preferences({ value, onChange }: { value: Preference; onChange: (p: Preference) => void }) {
  return <View style={{ gap: 9 }}>
    <Text style={s.label}>Hva er viktigst for deg?</Text>
    <View style={styles.segment}>{(['balanced', 'fastest', 'safest'] as Preference[]).map(p => <Pressable key={p} accessibilityRole="button" accessibilityState={{ selected: value === p }} onPress={() => onChange(p)} style={[styles.segmentItem, value === p && { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }]}><Text style={{ fontSize: 13, fontWeight: '600', color: value === p ? colors.ink : colors.muted }}>{preferenceLabels[p]}</Text></Pressable>)}</View>
    <Text style={[s.muted, { fontSize: 12 }]}>{value === 'balanced' ? 'God reisetid, med et øye på overgangene.' : value === 'fastest' ? 'Tidligere fremme, også når gevinsten er liten.' : 'God overgangsmargin og færre bytter.'}</Text>
  </View>;
}
export function TransportIcon({ mode }: { mode: TransportMode }) {
  return <Text accessibilityLabel={transport[mode].title} accessibilityRole="image" style={{ fontSize: 20 }}>{transport[mode].icon}</Text>;
}
export function LineBadge({ line, mode = 'bus' }: { line?: string; mode?: TransportMode }) {
  return <View style={[styles.badge, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}><TransportIcon mode={mode} /><Text style={{ color: colors.white, fontSize: 13, fontWeight: '700' }}>{vehicleName({ mode, line }, true)}</Text></View>;
}
export const clock = (value: string | number) => new Date(value).toLocaleTimeString('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' });

export function JourneyCard({ journey, now, index, onFollow, compact = false }: { journey: Journey; now: number; index?: number; onFollow?: () => void; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const buses = transitLegs(journey);
  const walk = Math.round(journey.legs.filter(l => l.mode === 'foot').reduce((sum, l) => sum + l.duration, 0) / 60);
  const realtime = buses.length > 0 && buses.every(l => isFresh(l, now));
  const day = new Date(departure(journey)).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'short' });
  return <View style={[s.card, compact && { padding: 18, backgroundColor: '#F9FBF7' }]}>
    <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
      <View style={s.row}><Text style={{ fontSize: compact ? 23 : 29, fontWeight: '600', color: colors.ink, letterSpacing: -1 }}>{clock(departure(journey))} <Text style={{ color: '#ABB6A9', fontWeight: '400' }}>→</Text> {clock(arrival(journey))}</Text></View>
      <Text style={[s.text, { fontWeight: '600' }]}>{Math.round(minutes(arrival(journey) - departure(journey)))} min</Text>
    </View>
    <View style={[s.row, { marginTop: 7, flexWrap: 'wrap' }]}><Text style={s.muted}>{day} · {buses.length <= 1 ? 'Ingen bytter' : `${buses.length - 1} bytte${buses.length > 2 ? 'r' : ''}`} · {walk} min gange</Text></View>
    <View style={[s.row, { marginVertical: 20, flexWrap: 'wrap', gap: 7 }]}>
      {journey.legs.map((l, i) => <React.Fragment key={l.id + i}>{i > 0 && <Text style={{ color: '#A3AFA0' }}>›</Text>}{l.mode !== 'foot' ? <LineBadge line={l.line} mode={l.mode} /> : <Text style={s.muted}>Gå {Math.round(l.duration / 60)}′</Text>}</React.Fragment>)}
    </View>
    <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
      <Text style={[s.muted, { color: realtime ? colors.green : colors.muted }]}>{!buses.length ? 'Beregnet gangtid' : realtime ? '● Sanntid' : '◷ Rutetid / delvis sanntid'}{index === 0 ? '  ·  Første forslag' : ''}</Text>
      <View style={s.row}><Button small secondary label={expanded ? 'Skjul detaljer' : 'Se detaljer'} onPress={() => setExpanded(!expanded)} />{onFollow && <Button small label="Følg reisen →" onPress={onFollow} />}</View>
    </View>
    {expanded && <View style={{ marginTop: 24 }}><Timeline journey={journey} now={now} /></View>}
  </View>;
}

export function Timeline({ journey, now, currentIndex = 0 }: { journey: Journey; now: number; currentIndex?: number }) {
  const changes = transfers(journey, now, currentIndex);
  return <View>{journey.legs.map((l, i) => {
    const change = changes.find(t => t.toIndex === i);
    return <View key={l.id + i} style={{ opacity: i < currentIndex ? 0.45 : 1 }}>
      {change && <View style={[styles.transfer, { backgroundColor: change.status === 'missed' ? colors.redBg : change.status === 'tight' ? colors.amberBg : colors.soft }]}>
        <Text style={[s.muted, { color: change.status === 'missed' ? colors.red : change.status === 'tight' ? colors.amber : colors.ink }]}>{change.status === 'unknown' ? 'Usikker overgang · sanntid mangler' : `${Math.round(change.margin)} min margin etter gangtid`}</Text>
      </View>}
      <View style={{ flexDirection: 'row', gap: 15, paddingBottom: 20 }}>
        <View style={{ alignItems: 'center', width: 14 }}><View style={{ width: l.mode !== 'foot' ? 12 : 8, height: l.mode !== 'foot' ? 12 : 8, borderRadius: 6, backgroundColor: l.mode !== 'foot' ? colors.green : '#B3BEAB', marginTop: 7 }} />{i < journey.legs.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 24, marginTop: 6, backgroundColor: colors.border }} />}</View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}><Text style={[s.text, { fontWeight: '600', flex: 1 }]}>{l.mode === 'foot' ? `Gå til ${l.to.name}` : l.from.name}</Text><Text style={[s.text, { fontWeight: '600' }]}>{clock(l.expectedStart)}</Text></View>
          {l.mode !== 'foot' ? <>
            <View style={[s.row, { flexWrap: 'wrap' }]}><LineBadge line={l.line} mode={l.mode} /><Text style={[s.muted, { flexShrink: 1 }]}>til {l.to.name}{l.from.platform ? ` · plattform ${l.from.platform}` : ''}</Text></View>
            <Text style={s.muted}>Rutetid {clock(l.aimedStart)} · {isFresh(l, now) ? 'Sanntid' : 'Usikker vurdering'}{l.cancelled ? ' · INNSTILT' : ''}</Text>
            <Text style={s.muted}>Fremme {clock(l.expectedEnd)} · rutetid {clock(l.aimedEnd)}</Text>
          </> : <Text style={s.muted}>{Math.round(l.duration / 60)} min · {Math.round(l.distance)} m</Text>}
        </View>
      </View>
    </View>;
  })}</View>;
}

export function AlertCard({ alert }: { alert: TravelAlert }) {
  const color = alert.kind === 'danger' ? colors.red : alert.kind === 'warning' ? colors.amber : colors.blue;
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" testID={`alert-${alert.id}`} style={{ backgroundColor: alert.kind === 'danger' ? colors.redBg : alert.kind === 'warning' ? colors.amberBg : colors.blueBg, padding: 16, borderRadius: 12, gap: 4, borderLeftWidth: 3, borderLeftColor: color }}>
    <Text style={[s.text, { fontWeight: '600', color }]}>{alert.title}</Text><Text style={[s.muted, { color }]}>{alert.detail}</Text>
  </View>;
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.ink, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.soft }, inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, minHeight: 54, backgroundColor: '#FAFBF8' },
  input: { flex: 1, color: colors.ink, fontSize: 15, paddingVertical: 15, outlineWidth: 0 } as any,
  dot: { height: 10, width: 10, borderWidth: 2, borderRadius: 5, borderColor: colors.ink }, options: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: colors.paper, borderRadius: 10, gap: 3 }, segmentItem: { flex: 1, alignItems: 'center', minHeight: 44, justifyContent: "center", paddingVertical: 10, borderRadius: 7, borderWidth: 1, borderColor: 'transparent' },
  badge: { backgroundColor: colors.green, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, minWidth: 32, alignItems: 'center' }, transfer: { marginLeft: 29, padding: 10, marginBottom: 16, borderRadius: 8 },
});
