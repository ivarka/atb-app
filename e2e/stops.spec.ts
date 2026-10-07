import { expect, test } from '@playwright/test';
test('flere stopp, opphold, gjenåpning og videre fra nytt sted', async ({ page }) => {
 await page.setViewportSize({ width: 390, height: 844 });
 await page.goto('/'); await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
 await page.getByRole('button', { name: '+ Legg til mellomstopp', exact: true }).click();
 await page.getByRole('button', { name: 'Velg Studentersamfundet', exact: true }).click();
 await page.getByRole('button', { name: 'Legg til valgt stopp', exact: true }).click();
 await page.getByRole('button', { name: '+ Legg til mellomstopp', exact: true }).click();
 await page.getByRole('button', { name: 'Velg Pirbadet', exact: true }).click();
 await page.getByRole('button', { name: 'Legg til valgt stopp', exact: true }).click();
 await page.getByRole('button', { name: 'Opphold', exact: true }).last().click();
 await page.getByRole('button', { name: 'Finn reiser' }).click();
 await page.getByRole('button', { name: 'Følg reisen' }).first().click();
 await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
 await page.getByRole('button', { name: 'Bekreft passert Studentersamfundet', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Jeg har gått av', exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Jeg er ved Pirbadet – start opphold', exact: true }).click();
 await expect(page.getByText('Opphold ved Pirbadet', { exact: true })).toBeVisible();
 await page.reload(); await expect(page.getByText('Opphold ved Pirbadet', { exact: true })).toBeVisible();
 await page.screenshot({ path: 'test-results/planlagte-stopp-mobil.png', fullPage: true });
 await expect(page.getByRole('button', { name: 'Oppdater nå', exact: true })).toHaveCount(0);
 await page.getByRole('button', { name: 'Klar til å fortsette', exact: true }).click();
 await page.getByRole('button', { name: 'Jeg har gått til Studentersamfundet', exact: true }).click();
 await page.getByRole('button', { name: 'Fortsett fra valgt sted', exact: true }).click();
 await expect(page.getByTestId('stop-route').first()).toContainText('Videre fra Studentersamfundet');
 await page.getByRole('button', { name: 'Velg denne videre reisen', exact: true }).first().click();
 await expect(page.getByText('Opphold ved Pirbadet', { exact: true })).toHaveCount(0);
 await expect(page.getByText(/Steg 1 av/).first()).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.getByRole('button', { name: 'Reisevalg', exact: true }).click();
 await page.getByRole('button', { name: 'Endre stopp', exact: true }).click();
 await page.getByRole('button', { name: '+ Legg til mellomstopp', exact: true }).click();
 await page.getByRole('button', { name: 'Velg Lohove', exact: true }).click();
 await page.getByRole('button', { name: 'Legg til valgt stopp', exact: true }).click();
 await page.getByRole('button', { name: 'Finn reise med disse stoppene', exact: true }).click();
 await expect(page.getByTestId('stop-route').first()).toBeVisible();
 await page.getByRole('button', { name: 'Avbryt endring', exact: true }).click();
 await expect(page.getByText(/Senere · Lohove/)).toHaveCount(0);
 await page.getByRole('button', { name: 'Endre stopp', exact: true }).click();
 await page.getByRole('button', { name: '+ Legg til mellomstopp', exact: true }).click();
 await page.getByRole('button', { name: 'Velg Lohove', exact: true }).click();
 await page.getByRole('button', { name: 'Legg til valgt stopp', exact: true }).click();
 await page.getByRole('button', { name: 'Finn reise med disse stoppene', exact: true }).click();
 await page.getByRole('button', { name: 'Velg denne videre reisen', exact: true }).first().click();
 await expect(page.getByText(/Senere · Lohove/)).toBeVisible();
});

test('opphold poller ikke, ny GPS brukes og API-feil bevarer startsted', async ({ page, context }) => {
 const { boardingFixture } = await import('../tests/fixtures/boarding');
 const { active } = boardingFixture(Date.now());
 const place = active.journey.legs[0].to;
 active.stops = [{ id: 'pause', place, mode: 'pause', visited: true }];
 active.stay = { stopId: 'pause', place };
 active.progress = { phase: 'alighted', step: 'arrived', legIndex: active.journey.legs.length, confirmedAt: Date.now() };
 let requests = 0; let origin: any;
 await context.grantPermissions(['geolocation']);
 await context.setGeolocation({ latitude: 63.433, longitude: 10.396, accuracy: 10 });
 await page.route('**/geocoder/v1/reverse?**', route => route.fulfill({ json: { features: [{ properties: { label: 'Nytt sted', distance: .01 } }] } }));
 await page.route('**/journey-planner/v3/graphql', route => {
   requests++; origin = route.request().postDataJSON().variables.from;
   return route.fulfill({ status: 503, json: {} });
 });
 await page.addInitScript(active => {
   localStorage.setItem('underveis.v1', JSON.stringify({ version: 1, active, preference: 'balanced' }));
   Object.defineProperty(navigator, 'geolocation', { value: {
     getCurrentPosition(callback: (p: unknown) => void) { callback({ timestamp: Date.now(), coords: { latitude: 63.433, longitude: 10.396, accuracy: 10 } }); },
     watchPosition() { return 1; }, clearWatch() {},
   } });
 }, active);
 await page.clock.install(); await page.goto('/');
 await expect(page.getByRole('button', { name: 'Klar til å fortsette', exact: true })).toBeVisible();
 await page.clock.fastForward(120000); expect(requests).toBe(0);
 await page.getByRole('button', { name: 'Klar til å fortsette', exact: true }).click();
 await expect(page.getByText('Entur svarte med feil (503).', { exact: true })).toBeVisible();
 expect(origin.coordinates).toEqual({ latitude: 63.433, longitude: 10.396 }); expect(origin.place).toBeUndefined();
 await expect(page.getByRole('button', { name: 'Prøv igjen fra Ved Nytt sted', exact: true })).toBeVisible();
 expect(await page.evaluate(() => JSON.parse(localStorage.getItem('underveis.v1')!).active.stay.continuationFrom.latitude)).toBe(63.433);
 const before = requests; await page.clock.fastForward(120000); expect(requests).toBe(before);
});

test('ankomst til opphold krever ikke besøk av senere stopp', async ({ page }) => {
 const { demoJourneys, DEMO_FROM, DEMO_TO, DEMO_WRONG_STOP } = await import('../src/demo/provider');
 const now = Date.now(); const journey = demoJourneys(now)[0];
 journey.legs = [{ ...journey.legs[0], to: DEMO_WRONG_STOP }];
 const active = { journey, origin: DEMO_FROM, destination: DEMO_TO, walkingOnly: true, demo: true, startedAt: now,
   stops: [{ id: 'pause', place: DEMO_WRONG_STOP, mode: 'pause', visited: false }, { id: 'later', place: DEMO_FROM, mode: 'direct', visited: false }],
   progress: { phase: 'waiting', step: 'walking', legIndex: 0, confirmedAt: now } };
 await page.addInitScript(active => localStorage.setItem('underveis.v1', JSON.stringify({ version: 1, active, preference: 'balanced' })), active);
 await page.goto('/'); await page.getByRole('button', { name: 'Jeg er fremme', exact: true }).click();
 await expect(page.getByText('Opphold ved Studentersamfundet', { exact: true })).toBeVisible();
 await expect(page.getByText(/Senere · Lohove/)).toBeVisible();
});
