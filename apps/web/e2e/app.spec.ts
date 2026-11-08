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
    await stubApi(page);
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
    await expect(page.getByText('Demo sincronizada')).toBeVisible();

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

    await page.getByRole('button', { name: 'Marcar inicio A en el compás actual' }).click();
    await page.getByRole('button', { name: 'Marcar final B en el compás actual' }).click();
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
    await expect(page.getByText('Demo sincronizada')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar JSON' }).click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath('biblioteca.json');
    await download.saveAs(backupPath);

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Todavía no hay canciones')).toBeVisible();

    await page.getByLabel('Archivo de copia de seguridad').setInputFiles(backupPath);
    await expect(page.getByText('Demo sincronizada')).toBeVisible();
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

  test('resalta el acorde activo en menos de 250 ms al buscar', async ({ page }) => {
    await analyze(page);
    const slider = page.getByLabel('Posición de reproducción');

    const started = Date.now();
    await slider.fill('8');
    await expect(page.getByTestId('beat-cell-8')).toHaveAttribute('data-active', 'true', {
      timeout: 250,
    });
    expect(Date.now() - started).toBeLessThan(250);
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

    await page.getByRole('button', { name: 'Lista' }).click();
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

    await page.getByRole('button', { name: 'Lista' }).click();
    await expect(page.getByTestId('chord-row-0')).toBeVisible();
    await page.getByRole('button', { name: 'Parrilla' }).click();
    await expect(page.getByTestId('beat-row-0')).toBeVisible();
  });
});

test.describe('accesibilidad', () => {
  test.beforeEach(async ({ page }) => {
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
});
