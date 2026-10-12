import { expect,test } from '@playwright/test';
import { boardPlanned, closeDetails, scenario } from './helpers';
async function start(page:import('@playwright/test').Page) {
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Prøv demo',exact:true}).click();
 await page.getByRole('button',{name:'Finn reiser'}).click();
 await page.getByRole('button',{name:'Velg',exact:true}).first().click();
}
test('kompakt reise, tydelig detaljinngang, fokus og gjenåpning',async({page})=>{
 await start(page);
 await expect(page.getByTestId('travel-status').getByRole('button')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Jeg er på holdeplassen',exact:true})).toBeInViewport();
 await expect(page.getByRole('button',{name:'Se hele reisen →',exact:true})).toBeInViewport();
 await expect(page.getByRole('button',{name:'Avslutt og start på nytt',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Mistet overgang',exact:true})).toHaveCount(0);
 await boardPlanned(page);
 await expect(page.getByRole('button',{name:'Jeg har gått av',exact:true})).toBeInViewport();
 await page.screenshot({path:'test-results/compact-onboard.png',fullPage:true});
 const whole=page.getByRole('button',{name:'Se hele reisen →',exact:true});await whole.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Hele reisen',exact:true})).toBeVisible();
 await expect(page.getByText('✓ Fullført · Gå til Lohove holdeplass',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/Vis fullførte steg/}).click();
 await expect(page.getByText(/✓ Fullført ·/).first()).toBeVisible();
 await page.keyboard.press('Escape');await expect(whole).toBeVisible();await expect(whole).toBeFocused();
 await whole.click();await page.reload();await expect(page.getByRole('heading',{name:'Hele reisen',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Jeg har gått av',exact:true})).toBeInViewport();
 await page.setViewportSize({width:320,height:740});
 await page.addStyleTag({content:'div[dir="auto"] {font-size: 22px !important;}'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('venting har korte avgangsrader og detaljer uten påstigning',async({page})=>{
 await start(page);await page.getByRole('button',{name:'Jeg er på holdeplassen',exact:true}).click();
 const board=page.getByTestId('departure-board');
 await expect(board.getByText('Avganger neste 5 minutter',{exact:true})).toBeVisible();
 await expect(board.getByTestId('departure-row').first()).toBeVisible();
 expect(await board.getByTestId('departure-row').count()).toBeLessThanOrEqual(5);
 await expect(board.getByRole('button',{name:'Planlegg med denne',exact:true})).toHaveCount(0);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active.progress);
 await board.getByTestId('departure-row').first().click();
 await expect(page.getByRole('heading',{name:'Avgangsdetaljer',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active.progress)).toEqual(before);
 await closeDetails(page);
 await expect(page.getByRole('button',{name:'Se hele reisen →',exact:true})).toBeInViewport();
 await page.screenshot({path:'test-results/compact-waiting.png',fullPage:true});
 await board.getByRole('button',{name:'Se flere avganger →',exact:true}).click();
 await expect(page.getByRole('button',{name:'Neste avganger',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active.progress)).toEqual(before);
});

test('kritiske varsler vises også i detaljer og alternativ krever godkjenning',async({page})=>{
 await start(page);await scenario(page,'Mistet overgang');
 await expect(page.getByText('Du ser ikke ut til å rekke overgangen',{exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'Se hele reisen →',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Du ser ikke ut til å rekke overgangen'})).toBeVisible();
 await closeDetails(page);
 const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active.journey.id);
 await page.getByRole('button',{name:'Se alternativ',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active.journey.id)).toBe(id);
 await page.getByRole('button',{name:'Bytt til denne reisen'}).click();
 await expect(page.getByRole('heading',{name:'Alternativ reise',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('underveis.v1')!).active.journey.id)).not.toBe(id);
});

test('kompakt og full tavle deler data, og feil deaktiverer gamle avganger',async({page})=>{
 const {boardingFixture}=await import('../tests/fixtures/boarding');
 const now=Date.now(),{active}=boardingFixture(now);
 active.journey.legs[0].from.id='NSR:StopPlace:41613';
 active.journey.legs[0].serviceJourneyId='ATB:ServiceJourney:fixture';
 active.journey.legs[0].serviceDate='2026-10-12';
 let boards=0,fail=false;
 await page.addInitScript(active=>localStorage.setItem('underveis.v1',JSON.stringify({version:1,active,preference:'balanced'})),active);
 await page.route('**/journey-planner/v3/graphql',route=>{
  const query=route.request().postDataJSON().query as string;
  if(query.includes('query Departures(')){
   boards++;
   if(fail)return route.fulfill({status:503,json:{}});
   return route.fulfill({json:{data:{stopPlace:{estimatedCalls:Array.from({length:7},(_,i)=>({date:'2026-10-12',stopPositionInPattern:1,aimedDepartureTime:new Date(now+(i+1)*60000).toISOString(),expectedDepartureTime:new Date(now+(i+1)*60000).toISOString(),realtime:i!==1,predictionInaccurate:false,cancellation:i===2,forBoarding:true,quay:{id:'q',name:'Stopp 0',latitude:63.4,longitude:10.4,publicCode:'P2',stopPlace:{id:'NSR:StopPlace:41613'}},destinationDisplay:{frontText:i===0?'Sentrum med et veldig langt retningsnavn':'Sentrum'},serviceJourney:{id:`ATB:ServiceJourney:${i}`,line:{publicCode:String(i+1),transportMode:'bus',authority:{id:'ATB:Authority:2'}}}}))}}}});
  }
  if(query.includes('estimatedCalls'))return route.fulfill({json:{data:{serviceJourney:{estimatedCalls:active.journey.legs[0].calls!.map(c=>({quay:{id:`q${c.position}`,name:c.place.name,latitude:c.place.latitude,longitude:c.place.longitude,stopPlace:{id:c.position===0?'NSR:StopPlace:41613':`s${c.position}`}},stopPositionInPattern:c.position,aimedArrivalTime:c.aimedArrival,expectedArrivalTime:c.expectedArrival,aimedDepartureTime:c.aimedDeparture,expectedDepartureTime:c.expectedDeparture,realtime:true,forAlighting:true}))}}}});
  return route.fulfill({json:{data:{trip:{tripPatterns:[]}}}});
 });
 await page.clock.install({time:now});await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.getByTestId('departure-row')).toHaveCount(5);expect(boards).toBe(1);
 await page.getByRole('button',{name:'Innstillinger',exact:true}).click();
 await page.getByRole('button',{name:'Mørk',exact:true}).click();await closeDetails(page);expect(boards).toBe(1);
 await expect(page.getByTestId('departure-row').nth(1)).toContainText('Usikker tid');
 await page.getByTestId('departure-row').nth(2).click();
 const sheet=page.getByTestId('detail-sheet');await expect(sheet.getByText('Innstilt',{exact:true})).toBeVisible();
 await expect(sheet.getByRole('button',{name:'Jeg er om bord på denne',exact:true})).toHaveCount(0);
 await closeDetails(page);expect(boards).toBe(1);
 await page.getByRole('button',{name:'Se flere avganger →',exact:true}).click();
 await expect(page.getByTestId('departure-row')).toHaveCount(7);expect(boards).toBe(1);
 await page.getByTestId('departure-row').first().click();
 await expect(sheet.getByText('1 mot Sentrum med et veldig langt retningsnavn',{exact:true})).toBeVisible();
 fail=true;await page.clock.fastForward(31000);await expect.poll(()=>boards).toBe(2);
 await expect(sheet.getByRole('button',{name:'Jeg er om bord på denne',exact:true})).toBeDisabled();
 await expect(sheet.getByText(/Foreldet · usikker vurdering/)).toBeVisible();
 await closeDetails(page);
 await page.getByRole('button',{name:'← Tilbake',exact:true}).click();
 await page.getByRole('button',{name:'Endre reisen',exact:true}).click();
 const before=boards;await page.clock.fastForward(61000);expect(boards).toBe(before);
});
