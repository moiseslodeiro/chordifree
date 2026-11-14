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
  console.log(`Smoke test against ${apiUrl}`);
  console.log(`Fixture: ${fixturePath}`);

  const health = await request('/api/health').catch((error) => {
    fail(`Could not reach the API: ${error.message}`);
  });
  assert(health.response.ok, `GET /api/health returned ${health.response.status}`);
  assert(health.body?.status === 'ok', 'The API does not report itself healthy');
  console.log(`✓ API healthy (analyzer: ${health.body.analyzer})`);
  assert(health.body.analyzer === 'ok', 'The analyzer is not available');

  const bytes = await readFile(fixturePath).catch(() => {
    fail(`Fixture not found. Generate one with scripts/fixtures/make-fixture.sh`);
  });
  assert(bytes.length > 0, 'The fixture is empty');

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'chords.wav');
  const created = await request('/api/analyses', { method: 'POST', body: form });
  assert(
    created.response.status === 202,
    `POST /api/analyses returned ${created.response.status}: ${JSON.stringify(created.body)}`,
  );
  assert(typeof created.body?.id === 'string', 'The response does not include a job id');
  const jobId = created.body.id;
  console.log(`✓ Job created: ${jobId}`);

  const deadline = Date.now() + timeoutMs;
  let job = created.body;
  while (job.status !== 'done' && job.status !== 'error') {
    if (Date.now() > deadline) fail(`The analysis did not finish within ${timeoutMs / 1000} s`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, pollMs));
    const polled = await request(`/api/analyses/${jobId}`);
    assert(polled.response.ok, `GET /api/analyses/${jobId} returned ${polled.response.status}`);
    job = polled.body;
    process.stdout.write(`  status: ${job.status} (${job.progress ?? 0}%)\r`);
  }
  process.stdout.write('\n');

  if (job.status === 'error') {
    fail(`The analysis failed: ${job.error?.code ?? 'UNKNOWN'} — ${job.error?.message ?? ''}`);
  }

  const result = job.result;
  assert(result && typeof result === 'object', 'The finished job does not include a result');
  assert(
    typeof result.duration === 'number' && result.duration > 0,
    'The analysis duration is not valid',
  );
  assert(Array.isArray(result.segments) && result.segments.length > 0, 'There are no segments');

  let previousEnd = 0;
  let previousStart = -Infinity;
  for (const [index, segment] of result.segments.entries()) {
    assert(
      typeof segment.start === 'number' && typeof segment.end === 'number',
      `Segment ${index} has no numeric times`,
    );
    assert(segment.end > segment.start, `Segment ${index} has no positive duration`);
    assert(
      segment.start >= previousEnd - 1e-3,
      `Segment ${index} overlaps the previous one`,
    );
    assert(segment.start >= previousStart, `Segment ${index} breaks the order`);
    if (segment.chord !== null) {
      assert(
        Number.isInteger(segment.chord?.root) &&
          segment.chord.root >= 0 &&
          segment.chord.root <= 11,
        `Segment ${index} chord has no valid root`,
      );
      assert(
        typeof segment.chord?.quality === 'string' && segment.chord.quality.length > 0,
        `Segment ${index} chord has no quality`,
      );
    }
    previousEnd = segment.end;
    previousStart = segment.start;
  }

  const lastEnd = result.segments.at(-1).end;
  assert(
    Math.abs(result.duration - lastEnd) <= 1,
    `The timeline ends at ${lastEnd}s but the audio lasts ${result.duration}s`,
  );

  if (Array.isArray(result.beats)) {
    let previousBeat = -Infinity;
    for (const beat of result.beats) {
      assert(
        Number.isFinite(beat) && beat >= 0 && beat <= result.duration,
        `Beat out of range: ${beat}`,
      );
      assert(beat > previousBeat, 'Beats are not sorted or contain duplicates');
      previousBeat = beat;
    }
  }

  console.log(
    `✓ ${result.segments.length} valid segments, ${result.beats?.length ?? 0} beats, ` +
      `duration ${result.duration.toFixed(2)} s, analyzer ${result.analyzerVersion}`,
  );
  console.log('✓ Smoke test completed');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
