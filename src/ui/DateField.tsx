import React from 'react';
import { TextInput } from 'react-native';
export default function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <TextInput accessibilityLabel="Avreisetid" value={value} onChangeText={onChange} placeholder="ÅÅÅÅ-MM-DDTHH:mm" />;
}
