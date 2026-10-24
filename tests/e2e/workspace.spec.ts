import { test, expect } from '@playwright/test';
test('directory search, filters, empty state, and application details', async ({ page }) => {
  await page.goto('/applications?demo=true');
  await expect(
    page.getByRole('heading', { name: 'Applications', exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'orders-api Orders Api', exact: true }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Search applications', exact: true }).fill('orders-api');
  await expect(page.getByText('Showing 1 of 8 applications')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search applications', exact: true }).fill('no-such-app');
  await expect(page.getByRole('heading', { name: 'No matching applications' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('combobox', { name: 'Filter verification status' }).selectOption('failed');
  await expect(page.getByText('Showing 2 of 8 applications')).toBeVisible();
  await page.getByRole('combobox', { name: 'Filter verification status' }).selectOption('all');
  await page.getByRole('link', { name: 'orders-api Orders Api', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'orders-api', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.getByRole('cell', { name: '2.8.0', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Versions/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Branches', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Branches', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'main', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Deployments & releases' }).click();
  await expect(page.getByText('Staging', { exact: false }).first()).toBeVisible();
});
test('contract interactions, JSON and structural comparison', async ({ page }) => {
  await page.goto('/contracts?demo=true');
  const row = page
    .getByRole('row')
    .filter({ hasText: 'orders-api' })
    .filter({ hasText: 'payments-api' })
    .filter({ hasText: '2.8.0' })
    .first();
  await row.getByRole('button', { name: 'Explore', exact: true }).click();
  const explorer = page.getByRole('region', { name: 'Contract explorer' });
  await expect(explorer).toBeVisible();
  await expect(explorer.getByRole('heading', { name: 'get an existing resource' })).toBeVisible();
  await explorer.getByRole('textbox', { name: 'Search interactions' }).fill('missing');
  await explorer.getByRole('button', { name: /handle a missing resource/ }).click();
  await expect(explorer.getByRole('heading', { name: 'handle a missing resource' })).toBeVisible();
  await page.getByRole('tab', { name: 'Contract JSON' }).click();
  await expect(page.getByLabel('JSON content').first()).toContainText('pactSpecification');
  await page.getByRole('tab', { name: 'Compare versions' }).click();
  await page.getByRole('textbox', { name: 'Comparison consumer version' }).fill('2.7.0');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByText('$.interactions', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Verification', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Latest verification for this publication' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open build' })).toBeVisible();
});
test('deployment compatibility distinguishes safe, blocked and unknown', async ({ page }) => {
  await page.goto('/deploy?demo=true');
  await page.getByLabel('Application', { exact: true }).selectOption('orders-api');
  await page.getByLabel('Version', { exact: true }).selectOption('2.8.0');
  await page.getByLabel('Target environment').selectOption('production');
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  await expect(
    page.getByRole('heading', { name: 'Compatibility is not yet known.' }),
  ).toBeVisible();
  await page.getByLabel('Application', { exact: true }).selectOption('payments-api');
  await page.getByLabel('Version', { exact: true }).selectOption('2.8.0');
  await page.getByLabel('Target environment').selectOption('staging');
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  await expect(
    page.getByRole('heading', { name: 'A verification is blocking this deployment.' }),
  ).toBeVisible();
  await page.getByLabel('Version', { exact: true }).selectOption('2.7.0');
  await page.getByLabel('Target environment').selectOption('production');
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  await expect(page.getByRole('heading', { name: 'Your contracts are compatible.' })).toBeVisible();
});
test('graph search and environment records', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/dependencies?demo=true');
  await expect(page.getByLabel('Search dependency graph')).toBeVisible();
  await page.getByLabel('Focus application').selectOption('orders-api');
  await page.getByLabel('Highlight dependency direction').selectOption('upstream');
  await expect(page.locator('.react-flow__node')).toHaveCount(8);
  await page.getByLabel('Search dependency graph').fill('orders');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  expect(errors).toEqual([]);
  await page.goto('/environments?demo=true');
  await expect(page.getByRole('heading', { name: 'Currently deployed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Production' })).toBeVisible();
  await page.getByRole('button', { name: 'Staging' }).click();
  await expect(page.getByRole('cell', { name: '2.8.0', exact: true }).first()).toBeVisible();
});
test('responsive screenshots and persistent theme', async ({ page }, info) => {
  await page.goto('/applications?demo=true');
  await expect(page.getByText('Showing 8 of 8 applications')).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/applications-${info.project.name}.png`,
    fullPage: true,
  });
  const width = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  if (info.project.name === 'mobile')
    await page.getByRole('link', { name: 'Applications', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: `docs/screenshots/applications-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
