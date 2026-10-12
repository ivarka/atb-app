import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ActiveJourney } from '../domain/types';
import { journeyStrip } from '../domain/journeyStrip';
import { transport } from '../domain/transport';
import { clock } from './components';
import { colors,s } from './theme';
export function JourneyStrip({active,now,uncertain,onPress}:{active:ActiveJourney;now:number;uncertain:boolean;onPress:()=>void}){
 const model=journeyStrip(active,now,uncertain),[focused,setFocused]=useState(false);
 return <Pressable testID="journey-strip" accessibilityRole="button" accessibilityLabel={`Reisefremdrift: ${model.note}. ${model.points.map(p=>`${p.state==='done'?'Fullført':p.state==='current'?'Nå':'Senere'} ${p.label}`).join(', ')}. Se hele reisen`} onPress={onPress} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={[{gap:6,paddingVertical:8,minHeight:44},focused&&{outlineWidth:3,outlineColor:colors.green}]}>
  <View style={{flexDirection:'row',alignItems:'flex-start'}}>{model.points.map((p,i)=><View testID={`strip-${p.state}`} key={p.key} style={{flex:1,minWidth:0,alignItems:'center',gap:3}}>
   <View style={{position:'absolute',top:17,left:0,right:0,height:2,backgroundColor:colors.border}}/>
   <View style={{backgroundColor:p.state==='current'?colors.soft:colors.paper,borderWidth:p.state==='current'?2:1,borderColor:p.state==='current'?colors.green:colors.border,borderRadius:18,width:36,height:36,alignItems:'center',justifyContent:'center'}}><Text style={s.text}>{p.state==='done'?'✓':p.mode?transport[p.mode].icon:p.symbol??'●'}</Text></View>
   <Text numberOfLines={2} style={[s.muted,{textAlign:'center',fontWeight:p.state==='current'?'700':'400'}]}>{p.label}</Text>
   {p.state==='current'&&<Text style={[s.muted,{fontWeight:'700'}]}>Nå</Text>}
  </View>)}</View>
  <Text style={[s.muted,{textAlign:'center'}]}>{model.note}</Text>
  {model.times.length>0&&<View style={[s.row,{justifyContent:'space-between',flexWrap:'wrap'}]}>{model.times.map(t=><Text key={t.label} style={[s.muted,{flexShrink:1}]}>{t.label} {clock(t.at)}{t.uncertain?' · usikker tid':''}</Text>)}</View>}
 </Pressable>;
}
