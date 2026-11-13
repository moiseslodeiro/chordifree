#!/usr/bin/env node
/**
 * End-to-end smoke test: uploads a fixture audio file, waits for the
 * analysis and validates the timeline invariants.
 *
 * Usage:
 *   API_URL=http://localhost:3001 node scripts/smoke-test.mjs
 *   FIXTURE=/path/audio.wav node scripts/smoke-test.mjs
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const apiUrl = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const fixturePath = resolve(process.env.FIXTURE ?? resolve(here, 'fixtures/chords.wav'));
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 180_000);
const pollMs = 1_000;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function request(path, options) {
  const response = await fetch(`${apiUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function main() {
  console.log(`Smoke test contra ${apiUrl}`);
  console.log(`Fixture: ${fixturePath}`);

  const health = await request('/api/health').catch((error) => {
    fail(`No se pudo contactar con la API: ${error.message}`);
  });
  assert(health.response.ok, `GET /api/health devolvió ${health.response.status}`);
  assert(health.body?.status === 'ok', 'La API no se declara sana');
  console.log(`✓ API sana (analyzer: ${health.body.analyzer})`);
  assert(health.body.analyzer === 'ok', 'El analizador no está disponible');

  const bytes = await readFile(fixturePath).catch(() => {
    fail(`No se encontró el fixture. Genera uno con scripts/fixtures/make-fixture.sh`);
  });
  assert(bytes.length > 0, 'El fixture está vacío');

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'chords.wav');
  const created = await request('/api/analyses', { method: 'POST', body: form });
  assert(
    created.response.status === 202,
    `POST /api/analyses devolvió ${created.response.status}: ${JSON.stringify(created.body)}`,
  );
  assert(typeof created.body?.id === 'string', 'La respuesta no incluye un id de trabajo');
  const jobId = created.body.id;
  console.log(`✓ Trabajo creado: ${jobId}`);

  const deadline = Date.now() + timeoutMs;
  let job = created.body;
  while (job.status !== 'done' && job.status !== 'error') {
    if (Date.now() > deadline) fail(`El análisis no terminó en ${timeoutMs / 1000} s`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, pollMs));
    const polled = await request(`/api/analyses/${jobId}`);
    assert(polled.response.ok, `GET /api/analyses/${jobId} devolvió ${polled.response.status}`);
    job = polled.body;
    process.stdout.write(`  estado: ${job.status} (${job.progress ?? 0}%)\r`);
  }
  process.stdout.write('\n');

  if (job.status === 'error') {
    fail(`El análisis falló: ${job.error?.code ?? 'UNKNOWN'} — ${job.error?.message ?? ''}`);
  }

  const result = job.result;
  assert(result && typeof result === 'object', 'El trabajo terminado no incluye resultado');
  assert(
    typeof result.duration === 'number' && result.duration > 0,
    'La duración del análisis no es válida',
  );
  assert(Array.isArray(result.segments) && result.segments.length > 0, 'No hay segmentos');

  let previousEnd = 0;
  let previousStart = -Infinity;
  for (const [index, segment] of result.segments.entries()) {
    assert(
      typeof segment.start === 'number' && typeof segment.end === 'number',
      `El segmento ${index} no tiene tiempos numéricos`,
    );
    assert(segment.end > segment.start, `El segmento ${index} no tiene duración positiva`);
    assert(
      segment.start >= previousEnd - 1e-3,
      `El segmento ${index} solapa con el anterior`,
    );
    assert(segment.start >= previousStart, `El segmento ${index} rompe el orden`);
    if (segment.chord !== null) {
      assert(
        Number.isInteger(segment.chord?.root) &&
          segment.chord.root >= 0 &&
          segment.chord.root <= 11,
        `El acorde del segmento ${index} no tiene una fundamental válida`,
      );
      assert(
        typeof segment.chord?.quality === 'string' && segment.chord.quality.length > 0,
        `El acorde del segmento ${index} no tiene cualidad`,
      );
    }
    previousEnd = segment.end;
    previousStart = segment.start;
  }

  const lastEnd = result.segments.at(-1).end;
  assert(
    Math.abs(result.duration - lastEnd) <= 1,
    `La línea de tiempo termina en ${lastEnd}s y el audio dura ${result.duration}s`,
  );

  if (Array.isArray(result.beats)) {
    let previousBeat = -Infinity;
    for (const beat of result.beats) {
      assert(
        Number.isFinite(beat) && beat >= 0 && beat <= result.duration,
        `Pulso fuera de rango: ${beat}`,
      );
      assert(beat > previousBeat, 'Los pulsos no están ordenados y sin duplicados');
      previousBeat = beat;
    }
  }

  console.log(
    `✓ ${result.segments.length} segmentos válidos, ${result.beats?.length ?? 0} pulsos, ` +
      `duración ${result.duration.toFixed(2)} s, analizador ${result.analyzerVersion}`,
  );
  console.log('✓ Smoke test completado');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
