import React from 'react';
export default function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input aria-label="Avreisetid" type="datetime-local" value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '14px', border: '1px solid #E1E7DE', borderRadius: 10, background: '#FAFBF8', fontSize: 14, color: '#183B35', fontFamily: 'inherit' }} />;
}
