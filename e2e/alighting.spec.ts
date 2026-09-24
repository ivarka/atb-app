import { expect, test } from '@playwright/test';
import { boardingFixture } from '../tests/fixtures/boarding';
test('GPS-avstigning krever bekreftelse og søker fra faktisk koordinat', async ({ page }) => {
  const now = Date.now();
  const { active } = boardingFixture(now);
  active.progress = { phase: 'onboard', step: 'onboard', legIndex: 0, confirmedAt: now - 120000 };
  const leg = active.journey.legs[0];
  leg.serviceJourneyId = 'ATB:ServiceJourney:test'; leg.serviceDate = '2026-09-19';
  const stop = leg.to;
  const samples = [0, 1, 2, 3].map(i => ({ place: { ...stop, latitude: stop.latitude + i * .00025 }, timestamp: now - 60000 + i * 20000, accuracy: 10 }));
  let requests = 0; const origins: any[] = [];
  await page.route('https://api.entur.io/journey-planner/v3/graphql', async route => {
    requests++; const body = route.request().postDataJSON();
    if (body.query.includes('estimatedCalls')) {
      await route.fulfill({ json: { data: { serviceJourney: { estimatedCalls: leg.calls!.map(c => ({
        quay: { id: `q${c.position}`, name: c.place.name, latitude: c.place.latitude, longitude: c.place.longitude, stopPlace: { id: `s${c.position}` } },
        stopPositionInPattern: c.position, aimedArrivalTime: c.aimedArrival, expectedArrivalTime: c.expectedArrival,
        aimedDepartureTime: c.aimedDeparture, expectedDepartureTime: c.expectedDeparture, realtime: true, forAlighting: true,
      })) } } } });
    } else {
      origins.push(body.variables.from);
      const from = body.variables.from.coordinates ?? stop;
      await route.fulfill({ json: { data: { trip: { tripPatterns: [{ legs: [{ mode: 'foot', duration: 600, distance: 600,
        aimedStartTime: new Date(now).toISOString(), expectedStartTime: new Date(now).toISOString(), aimedEndTime: new Date(now + 600000).toISOString(), expectedEndTime: new Date(now + 600000).toISOString(),
        fromPlace: { name: 'Faktisk sted', ...from }, toPlace: active.destination,
      }] }] } } } });
    }
  });
  await page.addInitScript(active => {
    localStorage.setItem('underveis.v1', JSON.stringify({ version: 1, active, preference: 'balanced' }));
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition(callback: unknown) { (window as any).gpsCallback = callback; return 1; }, clearWatch() { (window as any).gpsCallback = null; },
    } });
  }, active);
  await page.clock.install({ time: samples[0].timestamp });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Oppdater nå', exact: true })).toBeEnabled();
  const before = requests;
  for (const p of samples) {
    await page.clock.setFixedTime(p.timestamp);
    await page.evaluate(p => (window as any).gpsCallback({ timestamp: p.timestamp, coords: { latitude: p.place.latitude, longitude: p.place.longitude, accuracy: p.accuracy } }), p);
  }
  await expect(page.getByText('Har du gått av her?', { exact: true })).toBeVisible();
  await expect(page.getByText('Om bord på buss 3', { exact: true })).toBeVisible();
  expect(requests).toBe(before);
  await page.getByRole('button', { name: 'Nei, jeg er fortsatt om bord', exact: true }).click();
  await page.evaluate(p => (window as any).gpsCallback({ timestamp: p.timestamp + 1, coords: { latitude: p.place.latitude, longitude: p.place.longitude, accuracy: 10 } }), samples[3]);
  await expect(page.getByText('Har du gått av her?', { exact: true })).toHaveCount(0);
  await page.clock.setFixedTime(now + 1);
  await page.getByRole('button', { name: 'Jeg har gått av', exact: true }).click();
  await expect(page.getByText('Må oppdateres fra der du er', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recovery-option')).toHaveCount(1);
  expect(origins.at(-1)).toMatchObject({ coordinates: { latitude: samples[3].place.latitude, longitude: samples[3].place.longitude } });
  expect(origins.at(-1).place).toBeUndefined();
  await page.getByRole('button', { name: 'Velg denne videre reisen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jeg er fremme', exact: true })).toBeVisible();
});
