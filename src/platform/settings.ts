export type BoardTheme = 'light' | 'dark';
export type Settings = { boardTheme: BoardTheme; gpsEnabled: boolean };
const key='underveis.settings.v1';
export function loadSettings(): Settings {
 try {const s=JSON.parse(localStorage.getItem(key)??'{}');return {boardTheme:s?.boardTheme==='dark'?'dark':'light',gpsEnabled:typeof s?.gpsEnabled==='boolean'?s.gpsEnabled:true};}
 catch{return {boardTheme:'light',gpsEnabled:true};}
}
export function saveSettings(patch: Partial<Settings>) {
 try{localStorage.setItem(key,JSON.stringify({...loadSettings(),...patch}));}catch{/* Keep the in-memory choice when storage is unavailable. */}
}
