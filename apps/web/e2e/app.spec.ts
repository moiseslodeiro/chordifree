import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

test.describe('flujo completo', () => {
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

  test('arranca en inglés y permite cambiar a español', async ({ page }) => {
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

  test('analiza, traslada a notación española, traspone, edita, guarda y recarga', async ({
    page,
  }) => {
    await analyze(page);

    await expect(page.getByTestId('beat-cell-0')).toContainText('C');
    await expect(page.getByTestId('beat-cell-8')).toContainText('G');

    await page.getByRole('button', { name: 'Española' }).click();
    await expect(page.getByTestId('beat-cell-0')).toContainText('Do');
    await expect(page.getByTestId('beat-cell-8')).toContainText('Sol');

    await page.getByLabel('Alteraciones').selectOption('sharp');
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

  test('muestra grados, capo y confianza baja sin salir de la canción', async ({ page }) => {
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

  test('conserva el rango A-B y la velocidad al recargar', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Marcar inicio A' }).click();
    await page.getByTestId('beat-cell-0').click();
    await page.getByRole('button', { name: 'Marcar final B' }).click();
    await page.getByTestId('beat-cell-0').click();
    await page.getByRole('button', { name: 'Bucle', exact: true }).click();
    await page.getByLabel('Velocidad de reproducción').selectOption('1.25');

    await expect(page.getByText('00:00 – 00:04')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bucle', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Guardar en biblioteca' }).click();
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Demo sincronizada' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bucle', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('00:00 – 00:04')).toBeVisible();
    await expect(page.getByLabel('Velocidad de reproducción')).toHaveValue('1.25');
  });

  test('exporta la biblioteca y la restaura desde una copia JSON', async ({ page }, testInfo) => {
    await analyze(page);
    await page.getByRole('button', { name: 'Guardar en biblioteca' }).click();
    await page.getByRole('button', { name: 'Biblioteca' }).click();
    await expect(page.getByText('Demo sincronizada', { exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar JSON' }).click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath('biblioteca.json');
    await download.saveAs(backupPath);

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Todavía no hay canciones')).toBeVisible();

    await page.getByLabel('Copia de seguridad u hoja de acordes').setInputFiles(backupPath);
    await expect(page.getByText('Demo sincronizada', { exact: true })).toBeVisible();
    await expect(page.getByText(/Copia importada: 1 canción nueva/)).toBeVisible();
  });

  test('prepara una hoja de acordes para imprimir o guardar en PDF', async ({ page }) => {
    await analyze(page);

    await expect(page.getByRole('button', { name: 'Imprimir / PDF' })).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    const sheet = page.getByTestId('print-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Demo sincronizada');
    await expect(sheet).toContainText('G mayor');
    await expect(sheet).toContainText('IV');
    await expect(sheet).toContainText('00:08');
  });

  test('guarda la letra, actualiza los acordes con el capo y recupera la vista', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await expect(page.getByText('Todavía no hay letra')).toBeVisible();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Primera línea\nSegunda línea');
    await page.getByRole('button', { name: 'Guardar letra' }).click();
    await expect(page.getByText('Canción guardada en la biblioteca.')).toBeVisible();

    await expect(page.getByRole('button', { name: 'C en 00:00' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'G en 00:08' })).toBeVisible();
    await expect(page.getByText('Primera línea')).toBeVisible();

    await page.getByLabel('Capo').selectOption('2');
    await expect(page.getByRole('button', { name: 'A♯ en 00:00' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'F en 00:08' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Demo sincronizada' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Letra', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Primera línea')).toBeVisible();
    await expect(page.getByRole('button', { name: 'A♯ en 00:00' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page
      .getByTestId('song-grid-column')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByText('Segunda línea')).toBeVisible();
  });

  test('omite intro e interludio y permite anclar una línea al tiempo actual', async ({ page }) => {
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

    await expect(page.getByText('Segunda línea')).toBeVisible();
    await expect(page.getByText('[00:40]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'F en 00:52' })).toBeVisible();

    await page.getByRole('button', { name: 'Editar letra' }).click();
    await expect(page.getByLabel('Letra de la canción')).toHaveValue(
      'Primera línea\n[00:40] Segunda línea',
    );
  });

  test('mantiene el tiempo real del acorde dominante con la reducción máxima', async ({ page }) => {
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

    await page.getByRole('button', { name: /Reducir acordes/ }).click();
    await page.getByRole('button', { name: 'Reducir al máximo' }).click();

    await expect(page.getByTestId('beat-cell-0')).toContainText('C');
    await expect(page.getByTestId('beat-cell-1')).not.toContainText('G');
    await expect(page.getByTestId('beat-cell-2')).toContainText('G');
  });

  test('sin modo A o B, el clic reproduce desde el compás elegido', async ({ page }) => {
    await analyze(page);

    await page.getByTestId('beat-cell-8').click();

    await expect(page.getByText('Marca A y B')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar inicio A' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
  });

  test('arma A o B, previsualiza el compás y marca sin reproducir', async ({ page }) => {
    await analyze(page);

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
      await expect(page.getByTestId(`beat-cell-${index}`)).not.toHaveAttribute(
        'data-mark-preview',
      );
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

  test('Reproducir empieza en A y para en B si el bucle está apagado', async ({
    page,
  }) => {
    await analyze(page);

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

  test('la vista Compases agrupa un acorde por compás y corrige el tempo', async ({ page }) => {
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

  test('reanaliza una canción guardada y conserva la letra', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Línea que debe conservarse');
    await page.getByRole('button', { name: 'Guardar letra' }).click();
    await expect(page.getByText('Línea que debe conservarse')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Reanalizar' }).click();
    await expect(page.getByText('Canción reanalizada con el analizador actual.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Línea que debe conservarse')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Letra', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('resalta el acorde activo en menos de 250 ms al buscar', async ({ page }) => {
    await analyze(page);
    const slider = page.getByLabel('Posición de reproducción');

    const started = Date.now();
    await slider.fill('8');
    await expect(page.getByTestId('beat-cell-8')).toHaveAttribute('data-active', 'true', {
      timeout: 500,
    });
    expect(Date.now() - started).toBeLessThan(500);
  });

  test('navega por la fila y entre filas con el teclado', async ({ page }) => {
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

  test('reduce los acordes de paso y conserva la línea original en el editor', async ({ page }) => {
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

    await page.getByRole('button', { name: /Reducir acordes/ }).click();
    await expect(page.getByTestId('chord-row-2')).toHaveCount(0);
    await expect(page.getByTestId('chord-row-0')).toContainText('C');
    await expect(page.getByTestId('chord-row-1')).toContainText('A');

    await page.getByRole('button', { name: 'Editar acordes' }).click();
    await expect(page.getByLabel('Acorde del segmento')).toHaveCount(3);
  });

  test('empieza en tema claro, alterna a oscuro y conserva la elección', async ({ page }) => {
    await page.goto('/?fakePlayer=1');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: /Tema claro/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: /Tema oscuro/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('cambia de instrumento, alterna vistas y mantiene el layout de dos columnas', async ({
    page,
  }) => {
    await analyze(page);

    const gridColumn = page.getByTestId('song-grid-column');
    const toolsColumn = page.getByTestId('song-tools-column');
    await expect(gridColumn.getByTestId('beat-row-0')).toBeVisible();
    await expect(gridColumn.getByTestId('beat-row-0')).toContainText('00:00');
    await expect(gridColumn.getByTestId('beat-row-0')).toContainText('C1');
    await expect(gridColumn.getByTestId('beat-row-1')).toContainText('00:08');
    await expect(gridColumn.getByTestId('beat-row-1')).toContainText('C3');
    await expect(toolsColumn.getByRole('region', { name: 'Reproductor' })).toBeVisible();
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
});

test.describe('accesibilidad', () => {
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

  test('la pantalla de inicio no tiene violaciones críticas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Analiza una canción' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('la vista de canción con dos columnas no tiene violaciones críticas', async ({ page }) => {
    await analyze(page);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('la vista de letra no tiene violaciones críticas', async ({ page }) => {
    await analyze(page);

    await page.getByRole('button', { name: 'Letra', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir letra' }).click();
    await page.getByLabel('Letra de la canción').fill('Primera línea\nSegunda línea');
    await page.getByRole('button', { name: 'Guardar letra' }).click();
    await expect(page.getByText('Primera línea')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
