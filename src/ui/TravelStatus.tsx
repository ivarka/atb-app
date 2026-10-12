import React from 'react';
import { Text, View } from 'react-native';
import { s, colors } from './theme';
/** Shared compact shell for normal travel, stays and an unplanned ride. */
export function TravelStatus({ label, action, children }: { label: string; action: string; children: React.ReactNode }) {
 return <View testID="travel-status" style={[s.card,{padding:20,gap:10,borderTopWidth:3,borderTopColor:colors.green}]}>
  <Text style={[s.label,{color:colors.green}]}>{label}</Text>
  <Text accessibilityRole="header" style={[s.title,{fontSize:26}]}>{action}</Text>
  {children}
 </View>;
}
