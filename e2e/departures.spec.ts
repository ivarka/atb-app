import { expect, test } from '@playwright/test';
import { seedRecentPlaces } from './helpers';

test('tom planlegging, sist brukte, tastatur og skjulte mellomstopp',async({page,context})=>{
 await seedRecentPlaces(context); await page.setViewportSize({width:390,height:844});
 await page.route('**/journey-planner/v3/graphql',route=>route.fulfill({json:{data:{trip:{tripPatterns:[]}}}}));
 await page.goto('/');
 await expect(page.getByRole('textbox',{name:'Fra',exact:true})).toHaveValue('');
 await expect(page.getByRole('textbox',{name:'Til – reisemål',exact:true})).toHaveValue('');
 await expect(page.getByRole('textbox',{name:'Legg til stopp',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Fra',exact:true}).focus();
 await expect(page.getByText('Sist brukte steder',{exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByText('Sist brukte steder',{exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Fra',exact:true}).focus();await page.getByRole('button',{name:'Teststart',exact:true}).click();
 await page.getByRole('textbox',{name:'Til – reisemål',exact:true}).focus();await page.getByRole('button',{name:'Testmål',exact:true}).click();
 await page.getByRole('button',{name:'Finn reiser'}).click();await expect(page.getByText(/Ingen reiser funnet/)).toBeVisible();
 await page.getByRole('button',{name:'Tøm Fra',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Fra',exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Fjern Teststart fra sist brukte',exact:true}).click();
 await expect(page.getByRole('button',{name:'Teststart',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Tøm sist brukte steder',exact:true}).click();
 await page.reload();await page.getByRole('textbox',{name:'Fra',exact:true}).focus();await expect(page.getByText('Sist brukte steder',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Lukk stedsliste',exact:true}).click();
 await page.screenshot({path:'test-results/planning-106-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('uplanlagt påstigning uten plan, gjenåpning og godkjent videreplan',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Prøv demo',exact:true}).click();
 await page.getByRole('button',{name:'Jeg er allerede om bord',exact:true}).click();
 const row=page.getByTestId('departure-row').first();await expect(row).toContainText('3 mot Sentrum');
 await row.getByRole('button',{name:'Jeg er om bord på denne',exact:true}).click();
 await page.getByRole('button',{name:'Bekreft at jeg er om bord',exact:true}).click();
 await expect(page.getByText('Bekreftet påstigning',{exact:true})).toBeVisible();
 await expect(page.getByTestId('ride-option')).toHaveCount(0);
 await page.reload();await expect(page.getByText('Bekreftet påstigning',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Neste stopp er Studentersamfundet',exact:true}).click();
 await expect(page.getByTestId('ride-option').first()).toBeVisible();
 await page.screenshot({path:'test-results/onboard-106-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Følg denne videreplanen',exact:true}).first().click();
 await expect(page.getByText(/Steg .*Om bord på buss 3/)).toBeVisible();
 await expect(page.getByText('Bekreftet påstigning',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('planlegg med valgt avgang bekrefter ikke påstigning',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Prøv demo',exact:true}).click();await page.getByRole('button',{name:'Avganger',exact:true}).click();
 await page.getByTestId('departure-row').first().getByRole('button',{name:'Planlegg med denne',exact:true}).click();
 await page.getByRole('button',{name:'Finn reise med denne avgangen',exact:true}).click();
 await page.getByRole('button',{name:'Velg denne reisen',exact:true}).first().click();
 await expect(page.getByRole('button',{name:'Jeg er om bord',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active.progress.phase)).toBe('waiting');
});

test('avgangstavle viser datakvalitet og pauser uten synlig tavle',async({page,context})=>{
 await seedRecentPlaces(context);const now=Date.now();let calls=0;
 await page.route('**/journey-planner/v3/graphql',route=>{
  calls++;return route.fulfill({json:{data:{stopPlace:{estimatedCalls:[0,1].map(i=>({date:'2026-10-07',stopPositionInPattern:1,aimedDepartureTime:new Date(now+600000).toISOString(),expectedDepartureTime:new Date(now+720000).toISOString(),realtime:i===0,predictionInaccurate:false,cancellation:i===1,forBoarding:true,quay:{id:'q',name:'Teststart',latitude:63.431,longitude:10.392,publicCode:'P2',stopPlace:{id:'NSR:StopPlace:41613'}},destinationDisplay:{frontText:i===0?'Sentrum':'Dragvoll'},serviceJourney:{id:`ATB:ServiceJourney:${i}`,line:{publicCode:'3',transportMode:'bus',authority:{id:'ATB:Authority:2'}}}}))}}}});
 });
 await page.clock.install({time:now});await page.goto('/');await page.getByRole('button',{name:'Avganger',exact:true}).click();
 await page.getByRole('textbox',{name:'Holdeplass',exact:true}).focus();await page.getByRole('button',{name:'Teststart',exact:true}).click();
 await expect(page.getByTestId('departure-row')).toHaveCount(2);expect(calls).toBe(1);
 await expect(page.getByTestId('departure-row').first()).toContainText('2 min forsinket');
 await expect(page.getByTestId('departure-row').last()).toContainText('Innstilt');
 await expect(page.getByTestId('departure-row').last().getByRole('button')).toHaveCount(0);
 await page.clock.fastForward(31000);await expect.poll(()=>calls).toBe(2);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.fastForward(120000);expect(calls).toBe(2);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>calls).toBe(3);
 await page.getByRole('button',{name:'← Tilbake',exact:true}).click();await page.clock.fastForward(120000);expect(calls).toBe(3);
});

test('bekreftet transport og mellomstopp beholdes ved API-feil og gjenåpning',async({page})=>{
 const { confirmedRide }=await import('../src/domain/departures');
 const { demoDepartures, DEMO_STATION }=await import('../src/demo/departures');
 const { DEMO_TO, DEMO_WRONG_STOP }=await import('../src/demo/provider');
 const { newStop }=await import('../src/domain/stops');
 const active=confirmedRide(demoDepartures(Date.now(),DEMO_STATION)[0],DEMO_TO,Date.now(),null,false);
 active.stops=[newStop(DEMO_WRONG_STOP,'pause')];
 await page.addInitScript(saved=>{if(!localStorage.getItem('underveis.v1'))localStorage.setItem('underveis.v1',JSON.stringify(saved));},{version:1,active,preference:'balanced'});
 await page.route('**/journey-planner/v3/graphql',route=>route.fulfill({status:503,json:{error:'Kontrollert feil'}}));
 await page.goto('/');await expect(page.getByText('Bekreftet påstigning',{exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByTestId('ride-option')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('alert')).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active);
 expect(saved.progress.phase).toBe('onboard');expect(saved.pendingRide.departure.id).toBe(active.pendingRide!.departure.id);expect(saved.stops).toEqual(active.stops);
 await page.getByRole('button',{name:'Avslutt og start på nytt',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Fra',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active)).toBeNull();
});
