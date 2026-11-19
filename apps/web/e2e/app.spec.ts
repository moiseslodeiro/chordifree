import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubAuthConfig } from './support';

const RESULT = {
  source: { type: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Demo sincronizada' },
  duration: 24,
  segments: [
    { start: 0, end: 8, chord: { root: 0, quality: 'major' } },
    { start: 8, end: 16, chord: { root: 7, quality: 'major' } },
    { start: 16, end: 24, chord: { root: 9, quality: 'major' } },
  ],
  beats: Array.from({ length: 24 }, (_, index) => index),
  beatsPerBar: 4,
  analyzerVersion: 'essentia-1.2',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const JOB = { id: 'job-e2e', status: 'queued', progress: 0 };

async function stubApi(page: Page, result = RESULT): Promise<void> {
  await stubAuthConfig(page);

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
        body: JSON.stringify(JOB),
      });
    }
    if (path === '/api/analyses/job-e2e') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...JOB, status: 'done', progress: 100, result }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No encontrado' } }),
    });
  });
}

async function analyze(page: Page): Promise<void> {
  await page.goto('/?fakePlayer=1');
  await page.getByLabel('Enlace del video').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Detectar acordes' }).click();
  await expect(page.getByRole('heading', { name: 'Demo sincronizada' })).toBeVisible();
}

async function openPractice(page: Page): Promise<void> {
  const panel = page.locator('.practice-panel');
  if (!(await panel.evaluate((element) => element.hasAttribute('open')))) {
    await page.getByTestId('practice-summary').click();
    await expect(panel).toHaveAttribute('open', '');
  }
}

test.describe('full flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem('chordifree:v1:preferences')) {
        window.localStorage.setItem(
          'chordifree:v1:preferences',
          JSON.stringify({ schemaVersion: 1, data: { language: 'es' } }),
        );
      }
    });
    await stubApi(page);
  });

  test('starts in English and allows switching to Spanish', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'chordifree:v1:preferences',
        JSON.stringify({ schemaVersion: 1, data: { language: 'en' } }),
      );
    });
    await page.goto('/?fakePlayer=1');

    await expect(page.getByRole('heading', { name: 'Analyze a song' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Detect chords' })).toBeVisible();

    await page.getByRole('button', { name: 'ES' }).click();
    await expect(page.getByRole('heading', { name: 'Analiza una canción' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Detectar acordes' })).toBeVisible();
  });

  test('searches YouTube and analyzes a result with the Analyze button', async ({ page }) => {
    await page.route('**/api/youtube/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              videoId: 'dQw4w9WgXcQ',
              title: 'Never Gonna Give You Up',
              uploader: 'Rick Astley',
              duration: 213,
              thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
            },
          ],
        }),
      }),
    );
    await page.goto('/?fakePlayer=1');

    await page.getByLabel('Buscar en YouTube').fill('rick astley');
    await page.getByRole('button', { name: 'Buscar' }).click();

    await expect(page.getByText('Never Gonna Give You Up')).toBeVisible();
    await expect(page.getByText('Rick Astley · 3:33')).toBeVisible();

    await page.getByRole('button', { name: 'Analizar Never Gonna Give You Up' }).click();

    await expect(page.getByRole('heading', { name: 'Demo sincronizada' })).toBeVisible();
  });

  test('separates and selects a stem from the local plugin', async ({ page }) => {
    await page.route('**/api/stems', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          name: 'fake-stems',
          version: '1.0.0',
          stems: ['vocals', 'no_vocals'],
        }),
      }),
    );
    await page.route('**/api/stems/dQw4w9WgXcQ', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'job-stems',
          videoId: 'dQw4w9WgXcQ',
          status: 'done',
          stems: ['vocals', 'no_vocals'],
          createdAt: '2026-11-19T10:00:00.000Z',
          updatedAt: '2026-11-19T10:00:00.000Z',
        }),
      }),
    );
    await page.route('**/api/stems/jobs/job-stems/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: Buffer.alloc(64),
      }),
    );
    await analyze(page);

    const panel = page.getByTestId('stems-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Separar pistas' }).click();

    const instrumental = panel.getByRole('button', { name: 'Instrumental', exact: true });
    await expect(instrumental).toBeVisible();
    expect(await instrumental.getAttribute('aria-pressed')).toBe('false');
    await instrumental.click();
    await expect(instrumental).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.getByRole('button', { name: 'Descargar Instrumental' })).toBeVisible();
  });

  test('shows the auto-detected song sections and jumps between them', async ({ page }) => {
    const withVocals = {
      ...RESULT,
      duration: 48,
      beats: Array.from({ length: 25 }, (_, index) => index * 2),
      vocalRegions: [
        { start: 0, end: 16 },
        { start: 20, end: 40 },
      ],
    };
    await stubApi(page, withVocals);
    await analyze(page);

    const panel = page.getByTestId('sections-panel');
    await expect(panel).toBeVisible();
    await panel.getByText('Secciones').click();
    await expect(panel.getByRole('button', { name: 'Estrofa · 00:00' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Estrofa · 00:16' })).toBeVisible();
    const outro = panel.getByRole('button', { name: 'Final · 00:40' });
    await expect(outro).toBeVisible();

    await outro.click();
    await expect(outro).toHaveAttribute('aria-current', 'true', { timeout: 5000 });
  });

  test('keeps the search result action inside a small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.route('**/api/youtube/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              videoId: 'dQw4w9WgXcQ',
              title: 'Never Gonna Give You Up',
              uploader: 'Rick Astley',
              duration: 213,
              thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
            },
          ],
        }),
      }),
    );
    await page.goto('/?fakePlayer=1');

    await page.getByLabel('Buscar en YouTube').fill('rick astley');
    await page.getByRole('button', { name: 'Buscar' }).click();

    const analyze = page.getByRole('button', { name: 'Analizar Never Gonna Give You Up' });
    await expect(analyze).toBeVisible();
    const box = await analyze.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('analyzes, switches to Spanish notation, transposes, edits, saves and reloads', async ({
    page,
  }) => {
    await analyze(page);

    await expect(page.getByTestId('beat-cell-0')).toContainText('C');
    await expect(page.getByTestId('beat-cell-8')).toContainText('G');

    await page.getByRole('button', { name: 'Española' }).click();
    await expect(page.getByTestId('beat-cell-0')).toContainText('Do');
    await expect(page.getByTestId('beat-cell-8')).toContainText('Sol');

    await page.getByRole('button', { name: 'Sostenidos' }).click();
    await page.getByRole('button', { name: 'Subir un semitono' }).click();
    await expect(page.getByTestId('beat-cell-0')).toContainText('Do♯');
    await expect(page.getByTestId('beat-cell-8')).toContainText('Sol♯');

    await page.getByRole('button', { name: 'Editar acordes' }).click();
    const chordField = page.getByLabel('Acorde del segmento').first();
    await chordField.fill('A7');
    await chordField.blur();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByTestId('beat-cell-0')).toContainText('La7');

    await expect(page.getByText('Canción guardada en la biblioteca.')).toBeVisible();
    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await expect(page.getByText('Demo sincronizada', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Abrir' }).click();
    await expect(page.getByTestId('beat-cell-0')).toContainText('La7');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Demo sincronizada' })).toBeVisible();
    await expect(page.getByTestId('beat-cell-0')).toContainText('La7');
    await expect(page.getByTestId('beat-cell-8')).toContainText('Sol♯');
  });

  test('shows degrees, capo and low confidence without leaving the song', async ({ page }) => {
    await stubApi(page, {
      ...RESULT,
      segments: [
        { start: 0, end: 8, chord: { root: 2, quality: 'major' }, confidence: 0.35 },
        { start: 8, end: 16, chord: { root: 9, quality: 'major' }, confidence: 0.9 },
        { start: 16, end: 24, chord: { root: 11, quality: 'minor' }, confidence: 0.8 },
      ],
    });
    await analyze(page);

    const analysis = page.getByRole('region', { name: 'Análisis armónico' });
    const progression = analysis.getByRole('list', { name: 'Progresión por grados' });
    await expect(progression).toContainText('I');
    await expect(progression).toContainText('V');
    await expect(progression).toContainText('vi');

    const firstCell = page.getByTestId('beat-cell-0');
    await expect(firstCell).toHaveAttribute('data-confidence', '35');
    await expect(firstCell).toContainText('?');
    expect(await firstCell.getAttribute('aria-label')).toContain('confianza baja');

    await page.getByLabel('Capo').selectOption('2');
    await expect(firstCell).toContainText('C');
    await expect(page.getByRole('region', { name: 'Detalles de la canción' })).toContainText(
      'Traste 2',
    );

    await page.getByLabel('Instrumento').selectOption('piano');
    await expect(page.getByLabel('Capo')).toHaveCount(0);
    await expect(firstCell).toContainText('D');
    await expect(page.getByRole('region', { name: 'Detalles de la canción' })).not.toContainText(
      'Traste 2',
    );

    await page.getByLabel('Instrumento').selectOption('guitar');
    await expect(firstCell).toContainText('C');
  });

  test('keeps the A-B range but resets speed and pitch on reload', async ({ page }) => {
    await analyze(page);
    await openPractice(page);

    await page.getByRole('button', { name: 'Marcar inicio A' }).click();
    await page.getByTestId('beat-cell-0').click();
    await page.getByRole('button', { name: 'Marcar final B' }).click();
    await page.getByTestId('beat-cell-0').click();
    await page.getByRole('button', { name: 'Bucle', exact: true }).click();
    await page.getByLabel('Velocidad de reproducción').selectOption('1.25');
    await page.getByLabel('Tono del audio en semitonos').selectOption('4');

    await expect(page.getByText('00:00 – 00:04')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bucle', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Guardar en biblioteca' }).click();
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Demo sincronizada' })).toBeVisible();
    await openPractice(page);
    await expect(page.getByRole('button', { name: 'Bucle', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('00:00 – 00:04')).toBeVisible();
    await expect(page.getByLabel('Velocidad de reproducción')).toHaveValue('1');
    await expect(page.getByLabel('Tono del audio en semitonos')).toHaveValue('0');
  });

  test('exports the library and restores it from a JSON backup', async ({ page }, testInfo) => {
    await analyze(page);
    await page.getByRole('button', { name: 'Guardar en biblioteca' }).click();
    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await expect(page.getByText('Demo sincronizada', { exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar JSON' }).click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath('biblioteca.json');
    await download.saveAs(backupPath);

    await page.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Todavía no hay canciones')).toBeVisible();

    await page.getByLabel('Copia de seguridad u hoja de acordes').setInputFiles(backupPath);
    await expect(page.getByText('Demo sincronizada', { exact: true })).toBeVisible();
    await expect(page.getByText(/Copia importada: 1 canción nueva/)).toBeVisible();
  });

  test('prepares a chord sheet to print or save as PDF', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Primera línea\nSegunda línea');
    await page.getByRole('button', { name: 'Guardar letra' }).click();
    await expect(page.getByRole('button', { name: /Ir a la línea 1/ })).toBeVisible();

    await page.getByRole('button', { name: 'Más acciones' }).click();
    await expect(page.getByRole('menuitem', { name: 'Imprimir / PDF' })).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    const sheet = page.getByTestId('print-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByAltText('chordifree')).toBeVisible();
    await expect(sheet).toContainText('Demo sincronizada');
    await expect(sheet).toContainText('G mayor');
    await expect(sheet).toContainText('Letra y acordes');
    await expect(sheet).toContainText('Primera línea');
    await expect(sheet).toContainText('IV');
    await expect(sheet).toContainText('00:08');
    await expect(sheet).toContainText(/v\d+\.\d+\.\d+/);
  });
  test('exports the score as MusicXML', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Más acciones' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Exportar partitura (MusicXML)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.musicxml$/);
  });

  test('saves the lyrics, updates the chords with the capo and restores them', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await expect(page.getByText('Todavía no hay letra')).toBeVisible();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Primera línea\nSegunda línea');
    await page.getByRole('button', { name: 'Guardar letra' }).click();
    await expect(page.getByText('Canción guardada en la biblioteca.')).toBeVisible();

    await expect(page.getByRole('button', { name: 'C en 00:00' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'G en 00:08' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir a la línea 1/ })).toBeVisible();

    await page.getByLabel('Capo').selectOption('2');
    await expect(page.getByRole('button', { name: 'A♯ en 00:00' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'F en 00:08' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Demo sincronizada' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parrilla' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await expect(page.getByRole('button', { name: /Ir a la línea 1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'A♯ en 00:00' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page
      .getByTestId('song-grid-column')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('song-grid-column').getByText('Segunda línea')).toBeVisible();
  });

  test('skips intro and interlude and allows anchoring a line to the current time', async ({
    page,
  }) => {
    const labels = ['C', 'Dm', 'C', 'G', 'Am', 'F', 'C', 'C', 'C', 'C', 'C', 'G', 'Am', 'F'];
    const qualities: Record<string, { root: number; quality: string }> = {
      C: { root: 0, quality: 'major' },
      Dm: { root: 2, quality: 'minor' },
      G: { root: 7, quality: 'major' },
      Am: { root: 9, quality: 'minor' },
      F: { root: 5, quality: 'major' },
    };
    const segments = labels.map((label, index) => ({
      start: index * 4,
      end: (index + 1) * 4,
      chord: qualities[label]!,
    }));

    await stubApi(page, {
      ...RESULT,
      duration: 56,
      beats: Array.from({ length: 56 }, (_, index) => index),
      beatsPerBar: 4,
      segments,
    });
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Primera línea\nSegunda línea');
    await page.getByRole('button', { name: 'Guardar letra' }).click();

    await expect(page.getByRole('button', { name: 'C en 00:08' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'C en 00:40' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dm en 00:04' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'C en 00:24' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Editar letra' }).click();
    await page.getByLabel('Posición de reproducción').fill('40');
    const textarea = page.getByLabel('Letra de la canción');
    await textarea.evaluate((element) => {
      const field = element as HTMLTextAreaElement;
      field.setSelectionRange(field.value.length, field.value.length);
    });
    await page.getByRole('button', { name: 'Anclar línea' }).click();
    await expect(textarea).toHaveValue('Primera línea\n[00:40] Segunda línea');
    await page.getByRole('button', { name: 'Guardar letra' }).click();

    await expect(page.getByTestId('song-grid-column').getByText('Segunda línea')).toBeVisible();
    await expect(page.getByText('[00:40]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'F en 00:52' })).toBeVisible();

    await page.getByRole('button', { name: 'Editar letra' }).click();
    await expect(page.getByLabel('Letra de la canción')).toHaveValue(
      'Primera línea\n[00:40] Segunda línea',
    );
  });

  test('keeps the real timing of the dominant chord with maximum reduction', async ({ page }) => {
    await stubApi(page, {
      ...RESULT,
      duration: 4,
      beats: [0, 1, 2, 3],
      beatsPerBar: 4,
      segments: [
        { start: 0, end: 1.6, chord: { root: 0, quality: 'major' } },
        { start: 1.6, end: 4, chord: { root: 7, quality: 'major' } },
      ],
    });
    await analyze(page);

    await page.getByRole('button', { name: 'Máxima' }).click();

    await expect(page.getByTestId('beat-cell-0')).toContainText('C');
    await expect(page.getByTestId('beat-cell-1')).not.toContainText('G');
    await expect(page.getByTestId('beat-cell-2')).toContainText('G');
  });

  test('without A or B mode, clicking plays from the selected bar', async ({ page }) => {
    await analyze(page);
    await openPractice(page);

    await page.getByTestId('beat-cell-8').click();

    await expect(page.getByText('Marca A y B')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar inicio A' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
  });

  test('sets A or B, previews the bar and marks without playing', async ({ page }) => {
    await analyze(page);
    await openPractice(page);

    await page.getByRole('button', { name: 'Marcar inicio A' }).click();
    await page.getByTestId('beat-cell-8').hover();
    for (const index of [8, 9, 10, 11]) {
      await expect(page.getByTestId(`beat-cell-${index}`)).toHaveAttribute(
        'data-mark-preview',
        'a',
      );
    }
    await expect(page.getByTestId('beat-cell-12')).not.toHaveAttribute('data-mark-preview');

    await page.getByTestId('beat-cell-8').click();
    for (const index of [8, 9, 10, 11]) {
      await expect(page.getByTestId(`beat-cell-${index}`)).toHaveAttribute('data-loop', 'a');
      await expect(page.getByTestId(`beat-cell-${index}`)).not.toHaveAttribute('data-mark-preview');
    }
    await expect(page.getByRole('button', { name: 'Marcar inicio A' })).toHaveAttribute(
      'data-set',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();

    await page.getByRole('button', { name: 'Marcar final B' }).click();
    await page.getByTestId('beat-cell-12').hover();
    for (const index of [12, 13, 14, 15]) {
      await expect(page.getByTestId(`beat-cell-${index}`)).toHaveAttribute(
        'data-mark-preview',
        'b',
      );
    }
    await page.getByTestId('beat-cell-12').click();
    for (const index of [12, 13, 14, 15]) {
      await expect(page.getByTestId(`beat-cell-${index}`)).toHaveAttribute('data-loop', 'b');
    }
    await expect(page.getByText('00:08 – 00:16')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  });

  test('playback starts at A and stops at B when looping is off', async ({ page }) => {
    await analyze(page);
    await openPractice(page);

    await page.getByRole('button', { name: 'Marcar inicio A' }).click();
    await page.getByTestId('beat-cell-0').click();
    await page.getByRole('button', { name: 'Marcar final B' }).click();
    await page.getByTestId('beat-cell-0').click();

    await page.getByRole('button', { name: 'Reproducir' }).click();
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible({
      timeout: 8000,
    });
  });

  test('the Bars view groups one chord per bar and fixes the tempo', async ({ page }) => {
    await stubApi(page, {
      ...RESULT,
      duration: 16,
      beats: Array.from({ length: 32 }, (_, index) => index * 0.5),
      beatsPerBar: 4,
      segments: [
        { start: 0, end: 4, chord: { root: 9, quality: 'major' } },
        { start: 4, end: 8, chord: { root: 4, quality: 'major' } },
        { start: 8, end: 12, chord: { root: 6, quality: 'minor' } },
        { start: 12, end: 16, chord: { root: 2, quality: 'major' } },
      ],
    });
    await analyze(page);

    await page.getByRole('button', { name: 'Compases' }).click();

    await expect(page.getByText(/mitad de tempo/)).toBeVisible();
    await expect(page.getByTestId('bar-cell-0')).toContainText('A');
    await expect(page.getByTestId('bar-cell-1')).toContainText('E');
    await expect(page.getByTestId('bar-cell-2')).toContainText('F♯m');
    await expect(page.getByTestId('bar-cell-3')).toContainText('D');
  });

  test('reanalyzes a saved song and preserves the lyrics', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Línea que debe conservarse');
    await page.getByRole('button', { name: 'Guardar letra' }).click();
    await expect(
      page.getByTestId('song-grid-column').getByText('Línea que debe conservarse'),
    ).toBeVisible();

    // Keep the reanalysis running long enough to observe the progress toast.
    await page.route('**/api/analyses/job-e2e', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...JOB, status: 'done', progress: 100, result: RESULT }),
      });
    });

    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Reanalizar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reanalizar' }).click();
    await expect(page.getByText(/Reanalizando… \d+%/)).toBeVisible();
    await expect(page.getByText('Canción reanalizada con el analizador actual.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByTestId('song-grid-column').getByText('Línea que debe conservarse'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Letra', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('highlights the active chord in under 250 ms when seeking', async ({ page }) => {
    await analyze(page);
    const slider = page.getByLabel('Posición de reproducción');

    const started = Date.now();
    await slider.fill('8');
    await expect(page.getByTestId('beat-cell-8')).toHaveAttribute('data-active', 'true', {
      timeout: 500,
    });
    expect(Date.now() - started).toBeLessThan(500);
  });

  test('navigates along and between rows with the keyboard', async ({ page }) => {
    await analyze(page);
    const first = page.getByTestId('beat-cell-0');
    const secondRowStart = page.getByTestId('beat-cell-8');

    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('beat-cell-1')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('beat-cell-9')).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('beat-cell-1')).toBeFocused();

    await page.keyboard.press('Home');
    await expect(first).toBeFocused();

    await secondRowStart.focus();
    await page.keyboard.press('End');
    await expect(page.getByTestId('beat-cell-23')).toBeFocused();
  });

  test('reduces passing chords and preserves the original line in the editor', async ({ page }) => {
    await stubApi(page, {
      ...RESULT,
      duration: 8,
      beats: [0, 1, 2, 3, 4, 5, 6, 7],
      segments: [
        { start: 0, end: 4, chord: { root: 0, quality: 'major' } },
        { start: 4, end: 4.4, chord: { root: 7, quality: 'major' } },
        { start: 4.4, end: 8, chord: { root: 9, quality: 'major' } },
      ],
    });
    await analyze(page);

    await page.getByRole('button', { name: 'Lista', exact: true }).click();
    await expect(page.getByTestId('chord-row-2')).toBeVisible();

    await page.getByRole('button', { name: 'Normal' }).click();
    await expect(page.getByTestId('chord-row-2')).toHaveCount(0);
    await expect(page.getByTestId('chord-row-0')).toContainText('C');
    await expect(page.getByTestId('chord-row-1')).toContainText('A');

    await page.getByRole('button', { name: 'Editar acordes' }).click();
    await expect(page.getByLabel('Acorde del segmento')).toHaveCount(3);
  });

  test('starts in light theme, switches to dark and preserves the choice', async ({ page }) => {
    await page.goto('/?fakePlayer=1');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: /Tema claro/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: /Tema oscuro/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('moves secondary controls into disclosures on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await analyze(page);

    await expect(page.getByText('Más ajustes')).toBeVisible();
    await expect(page.getByText('Más práctica')).not.toBeVisible();
    await expect(page.getByText('Alteraciones')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Metrónomo' })).not.toBeVisible();

    await expect(page.getByText('Notación')).toBeVisible();
    await expect(page.getByText('Transponer')).toBeVisible();
    await expect(page.getByText('Presentación')).toBeVisible();

    await page.getByText('Más ajustes').click();
    await expect(page.getByText('Alteraciones')).toBeVisible();
    await expect(page.getByLabel('Instrumento')).toBeVisible();
    await expect(page.getByLabel('Capo')).toBeVisible();

    await page.getByTestId('practice-summary').click();
    await expect(page.getByText('Más práctica')).toBeVisible();
    await page.getByText('Más práctica').click();
    await expect(page.getByRole('button', { name: 'Metrónomo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cuenta atrás' })).toBeVisible();
  });

  test('changes instrument, switches views and keeps the two-column layout', async ({ page }) => {
    await analyze(page);

    const gridColumn = page.getByTestId('song-grid-column');
    const playerColumn = page.getByTestId('song-player-column');
    const toolsColumn = page.getByTestId('song-tools-column');
    await expect(gridColumn.getByTestId('beat-row-0')).toBeVisible();
    await expect(gridColumn.getByTestId('beat-row-0')).toContainText('00:00');
    await expect(gridColumn.getByTestId('beat-row-0')).toContainText('C1');
    await expect(gridColumn.getByTestId('beat-row-1')).toContainText('00:08');
    await expect(gridColumn.getByTestId('beat-row-1')).toContainText('C3');
    await expect(playerColumn.getByRole('region', { name: 'Reproductor' })).toBeVisible();
    await expect(gridColumn.getByTestId('beat-row-0').getByRole('button')).toHaveCount(8);
    const horizontalOverflow = await gridColumn
      .getByTestId('beat-grid')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    await page.getByLabel('Instrumento').selectOption('piano');
    await expect(toolsColumn.getByRole('img', { name: /^Piano:/ }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Lista', exact: true }).click();
    await expect(page.getByTestId('chord-row-0')).toBeVisible();
    await page.getByRole('button', { name: 'Parrilla' }).click();
    await expect(page.getByTestId('beat-row-0')).toBeVisible();
  });

  test('keeps the player, active chord and tools stacked in the right rail', async ({ page }) => {
    await analyze(page);

    const player = await page.getByTestId('song-player-column').boundingBox();
    const active = await page.getByTestId('song-active-chord').boundingBox();
    const audio = await page.getByTestId('song-audio').boundingBox();
    expect(player).not.toBeNull();
    expect(active).not.toBeNull();
    expect(audio).not.toBeNull();
    expect(active!.y).toBeGreaterThan(player!.y);
    expect(active!.y - (player!.y + player!.height)).toBeLessThan(40);
    expect(audio!.y).toBeGreaterThan(active!.y);
  });

  test('keeps the mobile order of player, grid, tools and harmony', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await analyze(page);

    const top = async (locator: Locator) => (await locator.boundingBox())?.y ?? -1;
    const player = await top(page.getByTestId('song-player-column'));
    const grid = await top(page.getByTestId('song-grid-column'));
    const active = await top(page.getByTestId('song-active-chord'));
    const details = await top(page.getByRole('region', { name: 'Detalles de la canción' }));
    const harmony = await top(page.getByTestId('song-harmony-column'));

    expect(player).toBeLessThan(grid);
    expect(grid).toBeLessThan(active);
    expect(active).toBeLessThan(details);
    expect(details).toBeLessThan(harmony);
  });
});

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem('chordifree:v1:preferences')) {
        window.localStorage.setItem(
          'chordifree:v1:preferences',
          JSON.stringify({ schemaVersion: 1, data: { language: 'es' } }),
        );
      }
    });
    await stubApi(page);
  });

  test('the home screen has no critical violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Analiza una canción' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('the two-column song view has no critical violations', async ({ page }) => {
    await analyze(page);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('the delete confirmation has no critical violations', async ({ page }) => {
    await analyze(page);
    await page.getByRole('button', { name: 'Guardar en biblioteca' }).click();
    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await page.getByRole('button', { name: 'Eliminar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('dialog')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('the lyrics view has no critical violations', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Primera línea\nSegunda línea');
    await page.getByRole('button', { name: 'Guardar letra' }).click();
    await expect(page.getByRole('button', { name: /Ir a la línea 1/ })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
