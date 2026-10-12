import { ActiveJourney, TransportMode } from './types';
import { isFresh } from './journey';
import { nextPause } from './stops';
export type StripPoint={key:string;label:string;mode?:TransportMode;state:'done'|'current'|'future';symbol?:string};
export function journeyStrip(a:ActiveJourney,now:number,uncertain=false){
 const index=a.progress.legIndex,legs=a.journey.legs;
 const completed:StripPoint={key:'completed',label:'Tidligere',symbol:'✓',state:'done'};
 if(a.stay)return {points:[completed,{key:'stay',label:a.stay.place.name,symbol:'Ⅱ',state:'current'},{key:'later',label:'Videre',symbol:'…',state:'future'}] as StripPoint[],times:[],note:'Beregnes når du fortsetter'};
 if(a.progress.needsReplan||a.pendingRide){
  const onboard=a.progress.phase==='onboard',leg=legs[index];
  const points:StripPoint[]=[...(index>0?[completed]:[]),{key:'actual',label:onboard?`Om bord ${leg?.line??''}`:a.progress.place?.name??'Her',mode:onboard?leg?.mode:undefined,state:'current'},{key:'unknown',label:'Videre',symbol:'…',state:'future'}];
  return {points,times:[],note:'Videreplan mangler'};
 }
 const pause=nextPause(a),arrived=a.progress.step==='arrived';
 const points:StripPoint[]=legs.map((l,i)=>({key:`leg:${i}`,label:l.mode==='foot'?'Gå':l.line??'Reis',mode:l.mode,state:i<index?'done':i===index?'current':'future'}));
 points.push({key:'goal',label:pause?'Opphold':'Mål',symbol:pause?'Ⅱ':'⚑',state:arrived?'current':'future'});
 const current=arrived?points.length-1:Math.min(index,points.length-1);
 let visible=points;
 if(points.length>5){const after=points.slice(current+1,-1);visible=[...(current>0?[completed]:[]),points[current],...after.slice(0,1),...(after.length>1?[{key:'more',label:`+${after.length-1} etapper`,symbol:'…',state:'future' as const}]:[]),...(current<points.length-1?[points.at(-1)!]:[])];}
 const bus=legs.slice(index).find(l=>l.mode!=='foot');
 const end=legs.at(-1)!;
 const times:{label:string;at:string;uncertain:boolean}[]=[];
 if(!arrived&&bus&&bus!==end)times.push({label:`Avstigning ${bus.to.name}`,at:bus.expectedEnd,uncertain:uncertain||!isFresh(bus,now)});
 if(!arrived)times.push({label:pause?'Opphold':'Mål',at:end.expectedEnd,uncertain:uncertain||legs.slice(index).some(l=>l.mode!=='foot'&&!isFresh(l,now))});
 return {points:visible,times,note:pause?'Sluttankomst beregnes når du fortsetter':arrived?'Fremme':a.progress.phase==='onboard'?'Om bord':a.progress.step==='waiting'?'Venter':'Til fots'};
}
