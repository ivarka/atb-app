import { describe, expect, it } from 'vitest';
import { visibleDepartures } from '../src/domain/departureDisplay';
import { demoDepartures, DEMO_STATION } from '../src/demo/departures';
const now=Date.now();
const rows=(minutes:number[])=>minutes.map((m,i)=>({...demoDepartures(now,DEMO_STATION)[0],id:String(i),expected:new Date(now+m*60000).toISOString()}));
describe('kompakt avgangstavle',()=>{
 it('inkluderer nøyaktig fem minutter og viser høyst fem rader',()=>{const d=rows([0,1,2,3,4,5,5.01]);expect(visibleDepartures(d,now,true)).toHaveLength(5);expect(visibleDepartures(d.slice(5),now,true).map(x=>x.id)).toEqual(['5']);});
 it('viser nærmeste avgang når ingen går innen fem minutter',()=>expect(visibleDepartures(rows([12,8,30]),now,true).map(x=>x.id)).toEqual(['1']));
 it('viser ingen passerte avganger i vanlig tavle',()=>{const d=rows([-1,2]);d[1].actual=new Date(now-1000).toISOString();expect(visibleDepartures(d,now,true)).toEqual([]);});
 it('beholder innstilling og usikker datakvalitet',()=>{const d=rows([2]);d[0].cancelled=true;d[0].quality='uncertain';expect(visibleDepartures(d,now,true)[0]).toMatchObject({cancelled:true,quality:'uncertain'});});
 it('kan vise flere rader og historiske avganger uten å endre data',()=>{const d=rows([-40,-20,-2,3,9]);expect(visibleDepartures(d,now,false,30,2).map(x=>x.id)).toEqual(['2','1']);expect(visibleDepartures(d,now,false,30,10)).toHaveLength(4);expect(d).toHaveLength(5);});
});
