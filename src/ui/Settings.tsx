import React, { createContext, useContext, useState } from 'react';
import { Text, View } from 'react-native';
import { BoardTheme, loadSettings, saveSettings } from '../platform/settings';
import { Travel } from '../screens/PlanningScreen';
import { Button, Preferences } from './components';
import { DetailSheet } from './DetailSheet';
import { s } from './theme';
export const boardPalettes={light:{background:'#F6F7F3',text:'#183B35',muted:'#52665D',border:'#CED8CF',focus:'#246A4C'},dark:{background:'#152723',text:'#F5F8EE',muted:'#CEDBD2',border:'#486056',focus:'#D9EF9F'}};
const Context=createContext({theme:'light' as BoardTheme,open:()=>{},opened:false});
export const useSettings=()=>useContext(Context);
export function SettingsButton(){const settings=useSettings();return <Button small secondary label="⚙" accessibilityLabel="Innstillinger" onPress={settings.open}/>;}
export function SettingsProvider({travel,children}:{travel:Travel;children:React.ReactNode}){
 const [theme,setTheme]=useState<BoardTheme>(()=>loadSettings().boardTheme),[opened,setOpened]=useState(false);
 const palette=boardPalettes[theme];
 const critical=travel.alerts.find(a=>a.kind==='danger')?.title || travel.error || (travel.active?.progress.needsReplan?'Videreplan må oppdateres':undefined);
 return <Context.Provider value={{theme,open:()=>setOpened(true),opened}}>{children}{opened&&<DetailSheet title="Innstillinger" onClose={()=>setOpened(false)} notice={critical?<Text accessibilityRole="alert" style={s.text}>{critical}</Text>:undefined}>
  <Text style={s.title}>Avgangstavle</Text>
  <View style={s.row}>{(['light','dark'] as const).map(t=><Button key={t} selected={theme===t} secondary={theme!==t} label={t==='light'?'Lys':'Mørk'} onPress={()=>{setTheme(t);saveSettings({boardTheme:t});}}/>)}</View>
  <View testID="board-preview" style={{backgroundColor:palette.background,padding:16,borderRadius:12,gap:12}}><Text style={{color:palette.muted}}>Linje       Retning                    Avgang</Text><View style={s.row}><Text style={{color:palette.text,fontWeight:'700'}}>🚌 3</Text><Text style={{color:palette.text,flex:1}}>Sentrum</Text><Text style={{color:palette.text,fontVariant:['tabular-nums']}}>4 min</Text></View></View>
  <Preferences value={travel.preference} onChange={travel.changePreference}/>
  <Text style={s.title}>Automatisk påstigning</Text>
  <View style={s.row}><Button label="På" selected={travel.gpsEnabled} secondary={!travel.gpsEnabled} onPress={()=>{if(!travel.gpsEnabled)travel.toggleGps();}}/><Button label="Av" selected={!travel.gpsEnabled} secondary={travel.gpsEnabled} onPress={()=>{if(travel.gpsEnabled)travel.toggleGps();}}/></View>
  <Text style={s.muted}>{travel.gpsEnabled?travel.gpsStatus:'Automatisk påstigning er slått av'}</Text>
  <Text style={s.text}>GPS brukes til å vurdere påstigning og foreslå avstigning. GPS kan ta feil; du kan alltid bekrefte manuelt. Avstigning krever bekreftelse. Sporingen pauses i bakgrunnen.</Text>
 </DetailSheet>}</Context.Provider>;
}
