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
