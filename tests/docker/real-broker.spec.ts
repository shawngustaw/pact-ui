import { test, expect, type Page } from '@playwright/test';
async function signIn(page: Page, password = 'reader-test-only') {
  await page.goto('/settings');
  await expect(page.getByLabel('Broker URL', { exact: true })).toHaveValue('http://broker:9292');
  await page.getByLabel('Username', { exact: true }).fill('reader-test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
}
test('real Broker sign-in, live reads, application details and credential reset', async ({
  page,
}, info) => {
  const calls: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => calls.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'wrong-password');
  await expect(page.getByRole('alert').filter({ hasText: 'credentials' })).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('reader-test-only');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Showing 2 of 2 applications')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /docker-orders-api Docker Orders Api/ }),
  ).toBeVisible();
  expect(calls.some((url) => url.includes('/api/broker'))).toBe(true);
  expect(
    calls.some(
      (url) => url.startsWith('http://broker:9292') || url.startsWith('http://127.0.0.1:9296'),
    ),
  ).toBe(false);
  await page.screenshot({
    path: `docs/screenshots/real-docker-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: /docker-orders-api Docker Orders Api/ }).click();
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.getByRole('cell', { name: '2.0.0', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Branches', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'main', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(storage).not.toContain('reader-test-only');
  expect(storage).not.toContain(btoa('reader-test:reader-test-only'));
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'credentials' }).first()).toBeVisible();
});
test('real contract content, failed verification, graph and deployed environments', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByText('Showing 2 of 2 applications')).toBeVisible();
  // Use client navigation to retain memory-only credentials.
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Contracts', exact: true }).click();
  const row = page
    .getByRole('row')
    .filter({ hasText: 'docker-orders-api' })
    .filter({ hasText: '2.0.0' })
    .first();
  await row.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'read an order from the real Docker Broker' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Verification', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open build' })).toHaveAttribute(
    'href',
    'https://example.org/real-docker-build/2.0.0',
  );
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Dependency graph', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Environments', exact: true }).click();
  await page.getByRole('button', { name: 'Staging' }).click();
  await expect(page.getByRole('cell', { name: '2.0.0', exact: true })).toHaveCount(2);
});
test('real can-i-deploy results through the Docker proxy', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('Showing 2 of 2 applications')).toBeVisible();
  if (test.info().project.name === 'mobile')
    await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Can I deploy?', exact: true }).click();
  await page.getByLabel('Application', { exact: true }).selectOption('docker-orders-api');
  await page.getByLabel('Version', { exact: true }).selectOption('1.0.0');
  await page.getByLabel('Target environment').selectOption('production');
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  await expect(page.getByRole('heading', { name: 'Your contracts are compatible.' })).toBeVisible();
  await page.getByLabel('Version', { exact: true }).selectOption('2.0.0');
  await page.getByLabel('Target environment').selectOption('staging');
  await page.getByRole('button', { name: 'Check compatibility' }).click();
  await expect(
    page.getByRole('heading', { name: 'A verification is blocking this deployment.' }),
  ).toBeVisible();
});

test('real Broker credentials remain isolated between reader and admin users', async ({
  page,
  browser,
  request,
}) => {
  await signIn(page);
  await expect(page.getByText('Showing 2 of 2 applications')).toBeVisible();
  const context = await browser.newContext();
  const admin = await context.newPage();
  try {
    await admin.goto('http://127.0.0.1:3002/applications');
    await expect(admin.getByRole('alert').filter({ hasText: 'credentials' })).toBeVisible();
    await admin.goto('http://127.0.0.1:3002/settings');
    await admin.getByLabel('Username', { exact: true }).fill('admin-test');
    await admin.getByLabel('Password', { exact: true }).fill('writer-test-only');
    await admin.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(admin.getByText('Showing 2 of 2 applications')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'credentials' })).toBeVisible();
    const write = await request.post('/api/broker?path=/pacticipants', {
      headers: {
        Authorization: `Basic ${Buffer.from('admin-test:writer-test-only').toString('base64')}`,
      },
      data: { name: 'must-not-be-created' },
    });
    expect(write.status()).toBe(405);
  } finally {
    await context.close();
  }
});
