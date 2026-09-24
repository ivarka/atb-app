import React, { useState } from 'react';
import { View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from './components';

export default function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const parsed = new Date(value);
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return <View style={{ gap: 10 }}>
    <Button secondary label={date.toLocaleDateString('nb-NO')} onPress={() => setMode('date')} />
    <Button secondary label={date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} onPress={() => setMode('time')} />
    {mode && <DateTimePicker value={date} mode={mode} is24Hour minimumDate={mode === 'date' ? new Date() : undefined}
      onChange={(event, selected) => {
        setMode(null);
        if (event.type !== 'set' || !selected) return;
        const local = new Date(selected.getTime() - selected.getTimezoneOffset() * 60000);
        onChange(local.toISOString().slice(0, 16));
      }} />}
  </View>;
}
