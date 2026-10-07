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
