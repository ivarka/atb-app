import { expect, test } from '@playwright/test';
import { boardingFixture } from '../tests/fixtures/boarding';

test('GPS foreslår, registrerer og angrer påstigning uten polling per posisjon', async ({ page }) => {
  const { active, samples } = boardingFixture(Date.now());
  const leg = active.journey.legs[0];
  leg.serviceJourneyId = 'ATB:ServiceJourney:test'; leg.serviceDate = '2026-09-18';
  let requests = 0;
  await page.route('https://api.entur.io/journey-planner/v3/graphql', async route => {
    requests++;
    const query = route.request().postDataJSON().query as string;
    const data = query.includes('estimatedCalls') ? { serviceJourney: { estimatedCalls: leg.calls!.map(c => ({
      quay: { id: `q${c.position}`, name: c.place.name, latitude: c.place.latitude, longitude: c.place.longitude, stopPlace: { id: `s${c.position}` } },
      stopPositionInPattern: c.position, aimedArrivalTime: c.aimedArrival, expectedArrivalTime: c.expectedArrival,
      aimedDepartureTime: c.aimedDeparture, expectedDepartureTime: c.expectedDeparture, realtime: true, forAlighting: true,
    })) } } : { trip: { tripPatterns: [] } };
    await route.fulfill({ json: { data } });
  });
  await page.addInitScript(active => {
    localStorage.setItem('underveis.v1', JSON.stringify({ version: 1, active, preference: 'balanced' }));
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition(callback: unknown) { (window as any).gpsCallback = callback; return 1; },
      clearWatch() { (window as any).gpsCallback = null; },
    } });
  }, active);
  await page.clock.install({ time: samples[0].timestamp });
  await page.goto('/');
  await expect(page.getByText('● Følger reisen', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Oppdater nå', exact: true })).toBeEnabled();
  const before = requests;
  async function emit(index: number) {
    await page.clock.setFixedTime(samples[index].timestamp);
    await page.evaluate(p => (window as any).gpsCallback({ timestamp: p.timestamp,
      coords: { latitude: p.place.latitude, longitude: p.place.longitude, accuracy: p.accuracy } }), samples[index]);
  }
  for (let i = 0; i < 4; i++) await emit(i);
  await expect(page.getByText('Vi tror du er på buss 3 – stemmer det?')).toBeVisible();
  expect(requests).toBe(before);
  for (let i = 4; i < 7; i++) await emit(i);
  await expect(page.getByText(/^Steg .*Om bord på buss 3$/)).toBeVisible();
  await page.getByRole('button', { name: 'Angre påstigning', exact: true }).click();
  await page.getByRole('button', { name: 'Vis steg for steg', exact: true }).click();
  await expect(page.getByText('Vent på buss 3', { exact: true })).toBeVisible();
  for (let i = 0; i < 7; i++) await emit(i);
  await expect(page.getByText('Vi tror du er på buss 3 – stemmer det?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
  await expect(page.getByText(/^Steg .*Om bord på buss 3$/)).toBeVisible();
});

test('nektet GPS-tilgang beholder manuell påstigning', async ({ page }) => {
  const { active } = boardingFixture(Date.now());
  await page.route('https://api.entur.io/**', route => route.fulfill({ status: 503, body: '{}' }));
  await page.addInitScript(active => {
    localStorage.setItem('underveis.v1', JSON.stringify({ version: 1, active, preference: 'balanced' }));
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition(_success: unknown, error: () => void) { error(); return 1; }, clearWatch() {},
      getCurrentPosition(_success: unknown, error: () => void) { error(); },
    } });
  }, active);
  await page.goto('/');
  await expect(page.getByText('Posisjon mangler. Gi tilgang til posisjon, eller bekreft påstigning manuelt.')).toBeVisible();
  await page.getByRole('button', { name: 'Reisevalg', exact: true }).click();
  await page.getByRole('button', { name: 'Slå av automatisk påstigning', exact: true }).click();
  await expect(page.getByText('Automatisk påstigning er slått av')).toBeVisible();
  await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
  await expect(page.getByText(/^Steg .*Om bord på buss 3$/)).toBeVisible();
  await page.getByRole('button', { name: 'Jeg har gått av', exact: true }).click();
  await expect(page.getByText('Hvor gikk du av?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Jeg gikk av på Stopp 1', exact: true }).click();
  await expect(page.getByText('Må oppdateres fra der du er', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Endre startsted', exact: true })).toBeVisible();
});
