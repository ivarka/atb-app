import { afterEach,it,expect,vi } from 'vitest';
import { loadSettings,saveSettings } from '../src/platform/settings';
afterEach(()=>vi.unstubAllGlobals());
it('gir eldre installasjoner lys tavle og GPS på, og tåler korrupt lagring',()=>{vi.stubGlobal('localStorage',{getItem:()=>'{bad'});expect(loadSettings()).toEqual({boardTheme:'light',gpsEnabled:true});});
it('lagrer uavhengige valg uten å overskrive hverandre',()=>{let data='{}';vi.stubGlobal('localStorage',{getItem:()=>data,setItem:(_k:string,v:string)=>{data=v;}});saveSettings({boardTheme:'dark'});saveSettings({gpsEnabled:false});expect(loadSettings()).toEqual({boardTheme:'dark',gpsEnabled:false});});
