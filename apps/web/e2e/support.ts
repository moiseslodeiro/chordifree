import type { Page } from '@playwright/test';

/**
 * The E2E stack only starts Vite, not the Express API. Answer the runtime auth
 * probe so the app stays in local mode instead of logging a proxy error.
 */
export async function stubAuthConfig(page: Page): Promise<void> {
  await page.route('**/api/auth/config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mode: 'none' }),
    }),
  );
}

/**
 * The E2E stack has no API server, so the optional stems status must be stubbed
 * or the proxy returns 500 and tests that forbid console errors fail.
 */
export async function stubStems(
  page: Page,
  status: { available: boolean; name?: string; version?: string; stems?: string[] } = {
    available: false,
  },
): Promise<void> {
  await page.route('**/api/stems', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(status),
    }),
  );
  await page.route('**/api/stems/cache', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [] }),
    }),
  );
  await page.route('**/api/stems/cache/**', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not cached' } }),
    }),
  );
  await page.route('**/api/stems/jobs', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobs: [] }),
    }),
  );
  await page.route('**/api/stems/setup', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ supported: false, installed: false, managed: false }),
    }),
  );
  await page.route('**/api/stems/setup/**', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No installer' } }),
    }),
  );
}
