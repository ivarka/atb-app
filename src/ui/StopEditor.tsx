import { DEMO_WRONG_STOP, DEMO_TO, DEMO_FROM } from '../demo/provider';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Place, PlannedStop } from '../domain/types';
import { newStop } from '../domain/stops';
import { Button, PlaceField } from './components';
import { s } from './theme';
export function StopEditor({ value, onChange, demo }: { value: PlannedStop[]; onChange: (stops: PlannedStop[]) => void; demo: boolean }) {
  const [place, setPlace] = useState<Place>();
  const update = (id: string, patch: Partial<PlannedStop>) => onChange(value.map(s => s.id === id ? { ...s, ...patch } : s));
  function move(index: number, delta: number) { const next = [...value]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next); }
  return <View style={{ gap: 12 }}><Text style={s.label}>Planlagte stopp</Text>
    {value.map((stop, i) => <View key={stop.id} style={{ gap: 8 }}><Text style={s.text}>{stop.visited ? '✓' : `${i + 1}.`} {stop.place.name}</Text>{!stop.visited && <>
      <View style={[s.row, { flexWrap: 'wrap' }]}><Button small label="Direkte videre" secondary={stop.mode !== 'direct'} onPress={() => update(stop.id, { mode: 'direct' })} /><Button small label="Opphold" secondary={stop.mode !== 'pause'} onPress={() => update(stop.id, { mode: 'pause' })} /></View>
      {stop.mode === 'pause' && <Text style={s.muted}>Fortsett når jeg er klar</Text>}
      <View style={[s.row, { flexWrap: 'wrap' }]}>{i > 0 && !value[i - 1].visited && <Button small secondary label={`Flytt ${stop.place.name} opp`} onPress={() => move(i, -1)} />}{i < value.length - 1 && <Button small secondary label={`Flytt ${stop.place.name} ned`} onPress={() => move(i, 1)} />}<Button small secondary label={`Fjern ${stop.place.name}`} onPress={() => onChange(value.filter(s => s.id !== stop.id))} /></View>
    </>}</View>)}
    {demo && <View style={{ gap: 8 }}>{[DEMO_WRONG_STOP, DEMO_TO, DEMO_FROM].map(p => <Button key={p.name} small secondary label={`Velg ${p.name}`} onPress={() => setPlace(p)} />)}</View>}
    <PlaceField key={value.length} label="Legg til stopp" value={place} onChange={setPlace} demo={demo} />
    <Button small secondary label="Legg til valgt stopp" disabled={!place} onPress={() => { if (place) { onChange([...value, newStop(place)]); setPlace(undefined); } }} />
  </View>;
}
