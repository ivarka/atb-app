import { expect, test } from '@playwright/test';

test('429 deles mellom faner og bevares ved gjenåpning', async ({ context, page }) => {
  let calls = 0;
  await context.route('https://api.entur.io/journey-planner/v3/graphql', async route => {
    calls++;
    await route.fulfill({ status: 429, headers: { 'Retry-After': '60', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Retry-After' }, body: '{}' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await expect(page.getByText(/API-kall er satt på pause til/)).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Finn reiser' }).click();
  await expect(page.getByText(/API-kall er satt på pause til/)).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.getByRole('button', { name: 'Finn reiser' }).click();
  await expect(other.getByText(/API-kall er satt på pause til/)).toBeVisible();
  await other.reload();
  await other.getByRole('button', { name: 'Finn reiser' }).click();
  await expect(other.getByText(/API-kall er satt på pause til/)).toBeVisible();
  expect(calls).toBe(1);
});
