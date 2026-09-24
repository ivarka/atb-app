import { expect, test } from '@playwright/test';
async function start(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Prøv demo', exact: true }).click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
}
test('egen reiseside, faktisk avstigning, godta og gjenåpne', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await expect(page.getByText('Reisen din', { exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Finn reiser' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Jeg er på holdeplassen', exact: true }).click();
  await expect(page.getByText(/Steg 2 av 8/)).toBeVisible();
  await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
  await expect(page.getByText(/Steg 3 av 8/)).toBeVisible();
  await page.getByRole('button', { name: '← Planlegg reise', exact: true }).click();
  await page.getByRole('button', { name: 'Til aktiv reise', exact: true }).click();
  await expect(page.getByText('Om bord på buss 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Jeg har gått av', exact: true }).click();
  await page.getByRole('button', { name: 'Jeg gikk av på Studentersamfundet', exact: true }).click();
  await expect(page.getByText('Må oppdateres fra der du er', { exact: true })).toBeVisible();
  await expect(page.getByText('FORVENTET ANKOMST', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('recovery-option')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/avstigning-mobil.png', fullPage: true });
  await page.reload();
  await expect(page.getByTestId('recovery-option')).toHaveCount(2);
  await page.getByRole('button', { name: 'Velg denne videre reisen', exact: true }).first().click();
  await expect(page.getByText('Må oppdateres fra der du er', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Vent på buss 21', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('ren gange etter avstigning og nettverksfeil bevarer faktisk sted', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
  await page.getByRole('button', { name: 'Nettverksfeil', exact: true }).click();
  await page.getByRole('button', { name: 'Jeg har gått av', exact: true }).click();
  await page.getByRole('button', { name: 'Jeg gikk av på Studentersamfundet', exact: true }).click();
  await expect(page.getByText('Må oppdateres fra der du er', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recovery-option')).toHaveCount(0);
  await page.getByRole('button', { name: 'I rute', exact: true }).click();
  await expect(page.getByTestId('recovery-option')).toHaveCount(2);
  await page.getByRole('button', { name: 'Velg denne videre reisen', exact: true }).last().click();
  await page.getByRole('button', { name: 'Jeg er fremme', exact: true }).click();
  await expect(page.getByText('Du er fremme', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Du er fremme', { exact: true })).toBeVisible();
  await expect(page.getByText('Oppdaterer reisen …', { exact: true })).toHaveCount(0);
});
test('innhentet avgangsforsinkelse blir ikke stående som aktuelt varsel', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Innhentet forsinkelse', exact: true }).click();
  await expect(page.getByText('Buss 3 fra Lohove holdeplass er forsinket', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Jeg er om bord', exact: true }).click();
  await expect(page.getByText('Buss 3 fra Lohove holdeplass er forsinket', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Prinsens gate .* – i rute/)).toBeVisible();
});
