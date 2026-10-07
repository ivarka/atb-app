import { expect, test } from '@playwright/test';

test('ekte Entur-data kan hentes direkte fra nettleseren', async ({ page }) => {
  test.skip(process.env.ATB_LIVE !== '1', 'Opt-in: avhenger av Entur og dagens rutetilbud.');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.screenshot({ path: 'test-results/underveis-desktop.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Fra', exact: true }).fill('Munkegata');
  await page.getByRole('button', { name: 'Munkegata, Trondheim', exact: true }).click();
  await page.getByRole('textbox', { name: 'Til – reisemål', exact: true }).fill('Lerkendal');
  await page.getByRole('button', { name: 'Lerkendal, Trondheim', exact: true }).first().click();
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await expect(page.getByText('Dine reiseforslag')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Følg reisen' }).first().click();
  await expect(page.getByText('● Følger reisen', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Reisen din', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/underveis-live.png', fullPage: true });
  expect(errors).toEqual([]);
});
