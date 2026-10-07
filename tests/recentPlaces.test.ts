import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { clearRecentPlaces, loadRecentPlaces, rememberPlaces, removeRecentPlace } from '../src/platform/recentPlaces';
beforeEach(()=>{const data=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});});
afterEach(()=>vi.unstubAllGlobals());
const place=(n:number)=>({id:`NSR:StopPlace:${n}`,name:`Sted ${n}`,latitude:63,longitude:10+n/100});
it('begrenser til ti steder og flytter nylig brukt sted først uten duplikat',()=>{rememberPlaces(Array.from({length:12},(_,i)=>place(i)));expect(loadRecentPlaces()).toHaveLength(10);rememberPlaces([place(5)]);expect(loadRecentPlaces()[0].place.id).toBe(place(5).id);expect(loadRecentPlaces().filter(r=>r.place.id===place(5).id)).toHaveLength(1);});
it('utelater GPS og demo',()=>{rememberPlaces([{...place(1),source:'gps'},{...place(2),id:'demo:2'},place(3)]);expect(loadRecentPlaces().map(r=>r.place.id)).toEqual([place(3).id]);});
it('kan fjerne ett sted og tømme historikken',()=>{rememberPlaces([place(1),place(2)]);removeRecentPlace(place(1));expect(loadRecentPlaces()).toHaveLength(1);clearRecentPlaces();expect(loadRecentPlaces()).toEqual([]);});
it('håndterer gammel, manglende og ugyldig lagring',()=>{expect(loadRecentPlaces()).toEqual([]);localStorage.setItem('underveis.recent-places.v1','broken');expect(loadRecentPlaces()).toEqual([]);});
