import { expect, test } from '@playwright/test';
test('ikoner og fremdrift for trikk, tog og båt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const name of ['Buss', 'Båt', 'Trikk', 'Tog']) await expect(page.getByRole('img', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
  await page.getByRole('button', { name: 'Båt, trikk og tog', exact: true }).click();
  await page.getByRole('button', { name: 'Vis steg for steg', exact: true }).click();
  for (const name of ['Båt', 'Trikk', 'Tog']) await expect(page.getByRole('img', { name, exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
  await expect(page.getByText('Om bord på trikk 9', { exact: true })).toBeVisible();
  await expect(page.getByText('Vent på tog R70', { exact: true })).toBeVisible();
  await expect(page.getByText('Vent på båt 810', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Oppdater nå', exact: true }).click();
  await expect(page.getByText('Vent på båt 810', { exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/transport-mobile.png', fullPage: true });
});
