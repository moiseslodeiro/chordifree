import { expect, test } from '@playwright/test';

test.describe('audio pitch', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'AudioWorklet is verified in Chromium');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const worklets: string[] = [];
      (window as Window & { __worklets?: string[] }).__worklets = worklets;
      const prototype = AudioWorklet.prototype;
      const original = prototype.addModule;
      if (original) {
        prototype.addModule = function (url: string): Promise<void> {
          worklets.push(String(url));
          return original.call(this, url);
        };
      }
      window.localStorage.setItem(
        'chordifree:v1:preferences',
        JSON.stringify({ schemaVersion: 1, data: { language: 'en' } }),
      );
    });
  });

  test('shifts the demo audio while keeping the native element playing', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await expect(page.getByRole('heading', { name: 'Chordifree demo · C G Am F' })).toBeVisible();

    const pitch = page.getByLabel('Audio pitch in semitones');
    await expect(pitch).toBeEnabled();
    await pitch.selectOption('4');

    await page.getByRole('button', { name: 'Play' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0),
      )
      .toBeGreaterThan(0.5);

    const state = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return {
        paused: audio?.paused,
        preservesPitch: audio?.preservesPitch,
        worklets: (window as Window & { __worklets?: string[] }).__worklets ?? [],
      };
    });

    expect(state).toMatchObject({ paused: false, preservesPitch: false });
    expect(state.worklets).toContainEqual(expect.stringContaining('soundtouch-processor.js'));
    expect(errors).toEqual([]);

    await page.getByRole('button', { name: 'Pause' }).click();
  });

  test('keeps the native audio path when no pitch is selected', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the demo' }).click();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0),
      )
      .toBeGreaterThan(0.25);

    const state = await page.evaluate(() => {
      const audio = document.querySelector('audio');
      return {
        preservesPitch: audio?.preservesPitch,
        worklets: (window as Window & { __worklets?: string[] }).__worklets ?? [],
      };
    });
    expect(state.worklets).toEqual([]);
    expect(state.preservesPitch).not.toBe(false);
    await page.getByRole('button', { name: 'Pause' }).click();
  });
});
