import { Page, BrowserContext } from '@playwright/test';
export async function seedRecentPlaces(context: BrowserContext) {
 await context.addInitScript(() => { if (!localStorage.getItem('underveis.recent-places.v1')) localStorage.setItem('underveis.recent-places.v1',JSON.stringify([
  {place:{id:'NSR:StopPlace:41613',name:'Teststart',latitude:63.431,longitude:10.392},usedAt:Date.now()},
  {place:{id:'NSR:StopPlace:60257',name:'Testmål',latitude:63.412,longitude:10.4},usedAt:Date.now()},
 ])); });
}
export async function chooseRecentRoute(page: Page) {
 await page.getByRole('textbox',{name:'Fra',exact:true}).focus();
 await page.getByRole('button',{name:'Teststart',exact:true}).click();
 await page.getByRole('textbox',{name:'Til – reisemål',exact:true}).focus();
 await page.getByRole('button',{name:'Testmål',exact:true}).click();
}

export async function closeDetails(page: import('@playwright/test').Page) {
 const dialog=page.getByTestId('detail-sheet');
 if(await dialog.count()){await dialog.getByRole('button',{name:'← Tilbake',exact:true}).click();await dialog.waitFor({state:'detached'});}
}
export async function openOptions(page: import('@playwright/test').Page) {
 await closeDetails(page);
 await page.getByRole('button',{name:'Endre reisen',exact:true}).click();
}
export async function scenario(page: import('@playwright/test').Page,name:string) {
 await openOptions(page);
 await page.getByRole('button',{name:'Demo · simuler hendelse',exact:true}).click();
 await page.getByRole('button',{name,exact:true}).click();
}
export async function boardPlanned(page: import('@playwright/test').Page) {
 await closeDetails(page);
 const stop=page.getByRole('button',{name:'Jeg er på holdeplassen',exact:true});
 if(await stop.isVisible())await stop.click();
 await page.getByRole('button',{name:'Jeg er om bord',exact:true}).click();
}
