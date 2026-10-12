import { closeDetails, openOptions, scenario, boardPlanned } from './helpers';
import { expect, test } from '@playwright/test';

test('søk, følg, forsinkelse, forslag og godta alternativ', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await expect(page.getByText('Dine reiseforslag')).toBeVisible();
  await page.getByRole('button', { name: 'Velg', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Se hele reisen →', exact: true })).toBeVisible();
  await scenario(page, 'Mistet overgang');
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toBeVisible();
  await expect(page.getByText('Ankomst er usikker')).toBeVisible();
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await page.screenshot({ path: 'test-results/underveis-demo.png', fullPage: true });
  await openOptions(page);
  await page.getByRole('button', { name: 'Oppdater nå', exact: true }).click();
  await closeDetails(page);
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toHaveCount(1);
  await page.getByRole('button', { name: 'Se alternativ', exact: true }).click();
  await page.getByRole('button', { name: 'Bytt til denne reisen' }).click();
  await page.getByRole('button', { name: 'Se hele reisen →', exact: true }).click();
  await expect(page.getByText('Vent på buss 12', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recommendation')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('om bord, databrudd og gjenåpning', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Velg', exact: true }).first().click();
  await boardPlanned(page);
  await scenario(page, 'Mistet overgang');
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await page.getByRole('button', { name: 'Se alternativ', exact: true }).click();
  await page.getByRole('button', { name: 'Bytt til denne reisen' }).click();
  await expect(page.getByText(/Steg .*Om bord på buss 3/)).toBeVisible();
  await scenario(page, 'Nettverksfeil');
  await expect(page.getByText('Simulert nettverksfeil. Sist kjente reise er bevart.')).toBeVisible();
  await expect(page.getByTestId('recommendation')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Steg .*Om bord på buss 3/)).toBeVisible();
  await openOptions(page);
  await expect(page.getByText(/Overvåkingen kan ha vært pauset/)).toBeVisible();
  await closeDetails(page);
  await page.getByRole('button', { name: 'Jeg har gått av', exact: true }).click();
  await page.getByRole('button', { name: 'Jeg gikk av på Prinsens gate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jeg er fremme', exact: true })).toBeVisible();
});

test('liten skjerm og preferanse', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Innstillinger', exact: true }).click();
  await page.getByRole('button', { name: 'Tryggest', exact: true }).click();
  await closeDetails(page);
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Velg', exact: true }).first().click();
  await page.getByRole('button', { name: 'Se hele reisen →', exact: true }).click();
  await expect(page.getByText('Vent på buss 12', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/underveis-mobile-web.png', fullPage: true });
});

test('skjult fane holder tilbake råd og oppdateres før de vises igjen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Velg', exact: true }).first().click();
  await scenario(page, 'Mistet overgang');
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('recommendation')).toHaveCount(0);
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toHaveCount(1);
});

test('innstilling, usikker sanntid og forsinket overgangsbuss', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Velg', exact: true }).first().click();
  await scenario(page, 'Knapp overgang');
  await expect(page.getByText('Knapp overgang', { exact: true })).toHaveCount(1);
  await scenario(page, 'Innstilt buss');
  await expect(page.getByText('Buss 3 er innstilt')).toBeVisible();
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await scenario(page, 'Uten sanntid');
  await expect(page.getByText('Usikker vurdering', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Buss 3 er innstilt')).toHaveCount(0);
  await scenario(page, 'Neste buss forsinket');
  await page.getByRole('button',{name:/Se alle varsler/}).click();
  await expect(page.getByText('Buss 25 fra Prinsens gate er forsinket')).toBeVisible();
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toHaveCount(0);
});
