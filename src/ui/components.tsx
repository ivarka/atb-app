import { transport, vehicleName } from '../domain/transport';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { autocomplete } from '../api/entur';
import { arrival, transitLegs, departure, isFresh, minutes, time, transfers } from '../domain/journey';
import { Journey, Place, Preference, TravelAlert, TransportMode } from '../domain/types';
import { colors, s } from './theme';

export function Button({ label, onPress, secondary, disabled, small, testID }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; small?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, small && { paddingVertical: 9, paddingHorizontal: 14 }, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={{ color: secondary ? colors.ink : colors.white, fontSize: small ? 13 : 15, fontWeight: '600' }}>{label}</Text>
  </Pressable>;
}

export function PlaceField({ label, value, onChange, demo }: { label: string; value?: Place; onChange: (p?: Place) => void; demo: boolean }) {
  const [text, setText] = useState(value?.name ?? '');
  const [options, setOptions] = useState<Place[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const version = useRef(0);
  useEffect(() => { if (value) { setText(value.name); setOptions([]); } }, [value]);
  useEffect(() => {
    if (demo || value || text.length < 2 || !focused) { setLoading(false); return; }
    const controller = new AbortController();
    const id = ++version.current;
    setError('');
    const timer = setTimeout(() => {
      setLoading(true);
      autocomplete(text, controller.signal).then(list => {
        if (id !== version.current) return;
        setOptions(list); setError(list.length ? '' : 'Ingen treff i Trøndelag. Prøv et mer presist navn.');
      }).catch(e => { if (!controller.signal.aborted) setError(e.message ?? 'Stedssøket feilet.'); }).finally(() => { if (id === version.current) setLoading(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); version.current++; };
  }, [text, value, focused, demo]);
  return <View style={{ gap: 8 }}>
    <Text style={s.label}>{label}</Text>
    <View style={[styles.inputWrap, focused && { borderColor: colors.green }]}>
      <View style={[styles.dot, label === 'Til' && { borderRadius: 3, backgroundColor: colors.ink }]} />
      <TextInput accessibilityLabel={label} placeholder={label === 'Fra' ? 'Hvor reiser du fra?' : 'Hvor skal du?'} placeholderTextColor={colors.muted} value={text} editable={!demo} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onChangeText={t => { setText(t); setOptions([]); onChange(undefined); }} style={styles.input} />
      {loading && <ActivityIndicator size="small" color={colors.green} />}
    </View>
    {options.length > 0 && <View style={styles.options}>{options.map((p, i) => <Pressable key={`${p.id}-${i}`} accessibilityRole="button" onPress={() => { onChange(p); setText(p.name); setOptions([]); setError(''); }} style={({ pressed }) => ({ padding: 12, backgroundColor: pressed ? colors.soft : colors.white, borderBottomWidth: i < options.length - 1 ? 1 : 0, borderColor: colors.border })}>
      <Text style={s.text}>{p.name}</Text><Text style={s.muted}>{p.id?.startsWith('NSR:') ? 'Holdeplass' : 'Adresse eller sted'}</Text>
    </Pressable>)}</View>}
    {!!error && <Text style={[s.muted, { color: colors.amber }]}>{error}</Text>}
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
  segment: { flexDirection: 'row', padding: 4, backgroundColor: colors.paper, borderRadius: 10, gap: 3 }, segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 7, borderWidth: 1, borderColor: 'transparent' },
  badge: { backgroundColor: colors.green, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, minWidth: 32, alignItems: 'center' }, transfer: { marginLeft: 29, padding: 10, marginBottom: 16, borderRadius: 8 },
});
