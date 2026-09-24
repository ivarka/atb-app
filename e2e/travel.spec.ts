import { expect, test } from '@playwright/test';

test('søk, følg, forsinkelse, forslag og godta alternativ', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await expect(page.getByText('Dine reiseforslag')).toBeVisible();
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
  await expect(page.getByText('Reisen din', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mistet overgang', exact: true }).click();
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toBeVisible();
  await expect(page.getByText('ANKOMST ER USIKKER')).toBeVisible();
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await page.screenshot({ path: 'test-results/underveis-demo.png', fullPage: true });
  await page.getByRole('button', { name: 'Oppdater nå', exact: true }).click();
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toHaveCount(1);
  await page.getByRole('button', { name: 'Bytt til denne reisen' }).click();
  await expect(page.getByText('Vent på buss 12', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recommendation')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('om bord, databrudd og gjenåpning', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
  await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
  await page.getByRole('button', { name: 'Mistet overgang', exact: true }).click();
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await page.getByRole('button', { name: 'Bytt til denne reisen' }).click();
  await expect(page.getByText('Om bord på buss 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nettverksfeil', exact: true }).click();
  await expect(page.getByText('Simulert nettverksfeil. Sist kjente reise er bevart.')).toBeVisible();
  await expect(page.getByTestId('recommendation')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Om bord på buss 3', { exact: true })).toBeVisible();
  await expect(page.getByText(/Overvåkingen kan ha vært pauset/)).toBeVisible();
  await page.getByRole('button', { name: 'Jeg har gått av', exact: true }).click();
  await page.getByRole('button', { name: 'Jeg gikk av på Prinsens gate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Jeg er fremme', exact: true })).toBeVisible();
});

test('liten skjerm og preferanse', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Tryggest', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
  await expect(page.getByText('Vent på buss 12', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/underveis-mobile-web.png', fullPage: true });
});

test('skjult fane holder tilbake råd og oppdateres før de vises igjen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
  await page.getByRole('button', { name: 'Mistet overgang', exact: true }).click();
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
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
  await page.getByRole('button', { name: 'Knapp overgang', exact: true }).click();
  await expect(page.getByText('Knapp overgang', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Innstilt buss', exact: true }).click();
  await expect(page.getByText('Buss 3 er innstilt')).toBeVisible();
  await expect(page.getByTestId('recommendation')).toBeVisible();
  await page.getByRole('button', { name: 'Uten sanntid', exact: true }).click();
  await expect(page.getByText('Usikker vurdering', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Buss 3 er innstilt')).toHaveCount(0);
  await page.getByRole('button', { name: 'Neste buss forsinket', exact: true }).click();
  await expect(page.getByText('Buss 25 fra Prinsens gate er forsinket')).toBeVisible();
  await expect(page.getByText('Du ser ikke ut til å rekke overgangen')).toHaveCount(0);
});
