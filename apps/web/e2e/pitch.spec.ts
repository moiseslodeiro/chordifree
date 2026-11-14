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

test.describe('YouTube temporary audio', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'AudioWorklet is verified in Chromium');

  test('switches from the video to temporary audio and back', async ({ page }) => {
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

    // Keep the real YouTube iframe out of the test; the switch does not need it.
    await page.route('https://www.youtube.com/**', (route) => route.abort());

    await page.route('**/api/health', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', analyzer: 'ok', analyzerVersion: 'essentia-1.2' }),
      }),
    );

    await page.route(/\/api\/analyses(?:\/|$)/, (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && path === '/api/analyses') {
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'job-pitch', status: 'queued', progress: 0 }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'job-pitch',
          status: 'done',
          progress: 100,
          result: {
            source: { type: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Temporary audio demo' },
            duration: 8,
            segments: [
              { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
              { start: 4, end: 8, chord: { root: 7, quality: 'major' } },
            ],
            beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5],
            beatsPerBar: 4,
            analyzerVersion: 'essentia-1.2',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      });
    });

    let prepares = 0;
    await page.route('**/api/youtube/dQw4w9WgXcQ/audio', async (route) => {
      if (route.request().method() === 'POST') {
        prepares += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: '/api/youtube/dQw4w9WgXcQ/audio' }),
        });
        return;
      }
      await route.fulfill({
        path: 'public/demo.wav',
        contentType: 'audio/wav',
      });
    });

    await page.goto('/');
    await page.getByLabel('Video link').fill('https://youtu.be/dQw4w9WgXcQ');
    await page.getByRole('button', { name: 'Detect chords' }).click();
    await expect(page.getByRole('heading', { name: 'Temporary audio demo' })).toBeVisible();
    await expect(page.getByTestId('player-video')).toBeVisible();
    expect(prepares).toBe(0);

    await page.getByLabel('Audio pitch in semitones').selectOption('4');
    await expect(page.getByText(/The pitch is applied to temporary audio/)).toBeVisible();
    await expect(page.getByTestId('player-video')).not.toBeVisible();
    expect(prepares).toBe(1);

    const audio = page.locator('audio');
    await expect(audio).toHaveAttribute('src', '/api/youtube/dQw4w9WgXcQ/audio');

    await page.getByRole('button', { name: 'Play' }).click();
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0.25);

    await page.getByLabel('Audio pitch in semitones').selectOption('0');
    await expect(page.getByTestId('player-video')).toBeVisible();
    await expect(audio).not.toBeVisible();
  });
});
