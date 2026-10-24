import { test, expect, type Page } from '@playwright/test';
const broker = 'http://127.0.0.1:9294';
async function connect(
  page: Page,
  user = 'broker-user',
  password = 'broker-password',
  mount = 'basic',
) {
  await page.goto('/settings');
  await page.getByLabel('Broker URL', { exact: true }).fill(`${broker}/${mount}`);
  await page.getByLabel('Authentication', { exact: true }).selectOption('basic');
  await page.getByLabel('Username', { exact: true }).fill(user);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
}
test('per-user Basic auth through the proxy, URL persistence and memory-only credentials', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await connect(page, 'broker-user', 'wrong-password');
  await expect(page.getByRole('alert').filter({ hasText: 'credentials' })).toContainText(
    'credentials',
  );
  await page.getByLabel('Password', { exact: true }).fill('broker-password');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(page.getByText('Showing 8 of 8 applications')).toBeVisible();
  expect(requests.some((url) => url.includes('/api/broker'))).toBe(true);
  expect(requests.some((url) => url.startsWith(broker))).toBe(false);
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(storage).toContain('/basic');
  for (const secret of ['broker-password', 'broker-user', btoa('broker-user:broker-password')])
    expect(storage).not.toContain(secret);
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'credentials' })).toContainText(
    'credentials',
  );
  await page.goto('/settings');
  await expect(page.getByLabel('Broker URL', { exact: true })).toHaveValue(`${broker}/basic`);
  await page.screenshot({
    path: `docs/screenshots/connection-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('works with an authenticated Broker that returns no CORS headers', async ({ page }) => {
  await connect(page, 'broker-user', 'broker-password', 'no-cors');
  await expect(page.getByText('Showing 8 of 8 applications')).toBeVisible();
});
test('runtime default is loaded from the server', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByLabel('Broker URL', { exact: true })).toHaveValue(`${broker}/basic`);
});
test('separate users cannot reuse another user’s credentials', async ({ page, browser }) => {
  await connect(page);
  await expect(page.getByText('Showing 8 of 8 applications')).toBeVisible();
  const other = await browser.newContext();
  const second = await other.newPage();
  try {
    await second.goto('http://127.0.0.1:3100/applications');
    await expect(second.getByRole('alert').filter({ hasText: 'credentials' })).toContainText(
      'credentials',
    );
    await second.goto('http://127.0.0.1:3100/settings');
    await second.getByLabel('Username', { exact: true }).fill('other-user');
    await second.getByLabel('Password', { exact: true }).fill('other-password');
    await second.getByRole('button', { name: 'Connect', exact: true }).click();
    await expect(second.getByText('Showing 8 of 8 applications')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'credentials' })).toContainText(
      'credentials',
    );
  } finally {
    await other.close();
  }
});
test('proxy rejects writes and unconfigured destinations', async ({ request }) => {
  expect((await request.post('/api/broker?path=/pacticipants')).status()).toBe(405);
  expect(
    (
      await request.get('/api/broker?path=/', {
        headers: { 'X-Pact-Broker-Url': 'http://169.254.169.254' },
      })
    ).status(),
  ).toBe(403);
});
