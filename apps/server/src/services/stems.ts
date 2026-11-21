import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import { ApiError } from '../errors';

/**
 * Optional local plugin that separates a song into stems. It is meant for the
 * desktop build: the plugin is a directory with a `manifest.json` and an
 * executable command, never something the server downloads by itself.
 */
const ManifestSchema = z
  .object({
    name: z.string().min(1).max(60),
    version: z.string().min(1).max(40),
    command: z.string().min(1),
    args: z.array(z.string()).min(1),
    stems: z
      .array(z.string().regex(/^[a-z0-9_-]{1,32}$/))
      .min(1)
      .max(12),
    outputExtension: z
      .string()
      .regex(/^\.[a-z0-9]{1,5}$/)
      .default('.wav'),
    /** Stems the plugin also transcribes to `<stem>.notes.json`. */
    transcribe: z
      .array(z.string().regex(/^[a-z0-9_-]{1,32}$/))
      .max(12)
      .optional(),
    timeoutSeconds: z.number().int().min(30).max(3600).optional(),
  })
  .strict();

export type StemManifest = z.infer<typeof ManifestSchema>;

export interface StemEngineStatus {
  available: boolean;
  name?: string;
  version?: string;
  stems?: string[];
  error?: string;
}

export interface StemNote {
  start: number;
  end: number;
  pitch: number;
  velocity?: number;
}

export interface StemSeparationResult {
  /** Stem name -> absolute file path. */
  stems: Map<string, string>;
  /** Stem name -> notes transcribed from that stem, if the plugin supports it. */
  notes: Map<string, StemNote[]>;
}

const NotesFileSchema = z.object({
  notes: z
    .array(
      z.object({
        start: z.number().min(0),
        end: z.number().min(0),
        pitch: z.number().int().min(0).max(127),
        velocity: z.number().int().min(1).max(127).optional(),
      }),
    )
    .max(20000),
});

export interface StemEngine {
  status(): Promise<StemEngineStatus>;
  separate(
    inputPath: string,
    outputDir: string,
    signal?: AbortSignal,
  ): Promise<StemSeparationResult>;
}

/** Local mode without a plugin: the API reports the feature as unavailable. */
export class NullStemEngine implements StemEngine {
  async status(): Promise<StemEngineStatus> {
    return { available: false };
  }

  async separate(
    _inputPath: string,
    _outputDir: string,
    _signal?: AbortSignal,
  ): Promise<StemSeparationResult> {
    throw new ApiError(
      'STEMS_UNAVAILABLE',
      'The stems plugin is not installed. See docs/STEMS_PLUGIN.md.',
    );
  }
}

function substitute(args: string[], input: string, output: string): string[] {
  return args.map((arg) => arg.replaceAll('{input}', input).replaceAll('{output}', output));
}

const RemoteJobSchema = z
  .object({
    id: z.string().min(1).max(200),
    status: z.enum(['queued', 'processing', 'done', 'error']),
    stems: z.array(z.string().regex(/^[a-z0-9_-]{1,32}$/)).max(12).optional(),
    error: z
      .object({
        code: z.string().max(100).optional(),
        message: z.string().max(1000).optional(),
      })
      .optional(),
  })
  .passthrough();

type RemoteJob = z.infer<typeof RemoteJobSchema>;

async function readRemoteJob(response: Response): Promise<RemoteJob> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('STEMS_FAILED', 'The stems service returned an invalid job');
  }
  const parsed = RemoteJobSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError('STEMS_FAILED', 'The stems service returned an invalid job');
  }
  return parsed.data;
}

/**
 * Optional remote separation service, configured with STEMS_SERVICE_URL. It is
 * meant for instances that cannot or do not want to run the models locally:
 * the same status shape as the local plugin, so the UI behaves identically.
 *
 * Contract (see docs/STEMS_PLUGIN.md):
 *   GET  /health                    -> { status, name?, version?, stems? }
 *   POST /separate  (multipart file) -> { id, status }
 *   GET  /jobs/:id                   -> { id, status, stems?, error? }
 *   GET  /jobs/:id/:stem             -> audio file
 */
export class RemoteStemEngine implements StemEngine {
  constructor(
    private readonly url: string,
    private readonly token = '',
    private readonly timeoutMs = 30 * 60 * 1000,
  ) {}

  async status(): Promise<StemEngineStatus> {
    try {
      const response = await fetch(this.endpoint('/health'), {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return { available: false, error: `HTTP ${response.status}` };
      const body = (await response.json()) as {
        status?: string;
        name?: string;
        version?: string;
        stems?: string[];
      };
      if (body.status !== 'ok') return { available: false, error: body.status ?? 'not ready' };
      return {
        available: true,
        ...(body.name ? { name: body.name } : {}),
        ...(body.version ? { version: body.version } : {}),
        ...(Array.isArray(body.stems) ? { stems: body.stems } : {}),
      };
    } catch (error) {
      return { available: false, error: error instanceof Error ? error.message : 'unreachable' };
    }
  }

  async separate(
    inputPath: string,
    outputDir: string,
    signal?: AbortSignal,
  ): Promise<StemSeparationResult> {
    if (signal?.aborted) throw new ApiError('STEMS_CANCELLED', 'Separation cancelled');
    await mkdir(outputDir, { recursive: true });
    const file = await readFile(inputPath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file)]), basename(inputPath));
    const response = await fetch(this.endpoint('/separate'), {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new ApiError('STEMS_FAILED', `The stems service answered HTTP ${response.status}`);
    }
    let job = await readRemoteJob(response);
    const startedAt = Date.now();
    while (job.status === 'queued' || job.status === 'processing') {
      if (signal?.aborted) throw new ApiError('STEMS_CANCELLED', 'Separation cancelled');
      if (Date.now() - startedAt > this.timeoutMs) {
        throw new ApiError('STEMS_TIMEOUT', 'The stems service took too long');
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const poll = await fetch(this.endpoint(`/jobs/${encodeURIComponent(job.id)}`), {
        headers: this.headers(),
        signal: AbortSignal.timeout(15000),
      });
      if (!poll.ok)
        throw new ApiError('STEMS_FAILED', `The stems service answered HTTP ${poll.status}`);
      job = await readRemoteJob(poll);
    }
    if (job.status === 'error') {
      throw new ApiError('STEMS_FAILED', job.error?.message ?? 'The stems service failed');
    }
    const stems = new Map<string, string>();
    for (const stem of job.stems ?? []) {
      const audio = await fetch(
        this.endpoint(`/jobs/${encodeURIComponent(job.id)}/${encodeURIComponent(stem)}`),
        { headers: this.headers(), signal: AbortSignal.timeout(this.timeoutMs) },
      );
      if (!audio.ok) {
        throw new ApiError('STEMS_FAILED', `The stems service did not return ${stem}`);
      }
      const path = join(outputDir, `${stem}.wav`);
      await writeFile(path, new Uint8Array(await audio.arrayBuffer()));
      stems.set(stem, path);
    }
    if (stems.size === 0) {
      throw new ApiError('STEMS_FAILED', 'The stems service returned no stems');
    }
    return { stems, notes: new Map() };
  }

  private endpoint(path: string): string {
    return `${this.url.replace(/\/+$/, '')}${path}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { ...extra, ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) };
  }
}

/**
 * Runs the command declared by the plugin manifest. The manifest is trusted
 * code: it is only read from the directory the operator configured, it never
 * runs through a shell, and `{input}`/`{output}` are substituted as single
 * arguments so paths cannot inject extra flags.
 */
export class PluginStemEngine implements StemEngine {
  constructor(private readonly directory: string) {}

  async status(): Promise<StemEngineStatus> {
    try {
      const manifest = await this.manifest();
      return {
        available: true,
        name: manifest.name,
        version: manifest.version,
        stems: manifest.stems,
      };
    } catch (error) {
      return {
        available: false,
        ...(error instanceof Error ? { error: error.message } : {}),
      };
    }
  }

  async separate(
    inputPath: string,
    outputDir: string,
    signal?: AbortSignal,
  ): Promise<StemSeparationResult> {
    if (signal?.aborted) throw new ApiError('STEMS_CANCELLED', 'Separation cancelled');
    // The plugin runs with its own directory as cwd, so relative temp paths
    // from the audio cache would resolve there instead of the server cwd.
    const absoluteInput = resolve(inputPath);
    const absoluteOutput = resolve(outputDir);
    const manifest = await this.manifest();
    if (!manifest.args.some((arg) => arg.includes('{input}'))) {
      throw new ApiError('STEMS_FAILED', 'The plugin manifest does not use {input}');
    }
    if (!manifest.args.some((arg) => arg.includes('{output}'))) {
      throw new ApiError('STEMS_FAILED', 'The plugin manifest does not use {output}');
    }
    await mkdir(absoluteOutput, { recursive: true });

    const stderr: string[] = [];
    const timeoutMs = (manifest.timeoutSeconds ?? 900) * 1000;
    await new Promise<void>((resolve, reject) => {
      // The plugin is usually a shell script that spawns Demucs; run it in its
      // own process group so cancelling also stops the real worker instead of
      // leaving an orphan consuming CPU in the background.
      const detached = process.platform !== 'win32';
      const child = spawn(
        manifest.command,
        substitute(manifest.args, absoluteInput, absoluteOutput),
        {
          cwd: this.directory,
          shell: false,
          detached,
          stdio: ['ignore', 'ignore', 'pipe'],
        },
      );
      const killTree = () => {
        if (detached && child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
            return;
          } catch {
            // Fall back to the direct child.
          }
        }
        child.kill('SIGKILL');
      };
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        killTree();
        reject(new ApiError('STEMS_TIMEOUT', 'The stems plugin took too long'));
      }, timeoutMs);
      const onAbort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        killTree();
        reject(new ApiError('STEMS_CANCELLED', 'Separation cancelled'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderr.length < 40) stderr.push(chunk.toString());
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(new ApiError('STEMS_FAILED', error.message));
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (code === 0) resolve();
        else {
          const detail = stderr.join('').trim().slice(-400);
          reject(
            new ApiError('STEMS_FAILED', detail || `The stems plugin exited with code ${code}`),
          );
        }
      });
    });

    const files = await readdir(absoluteOutput);
    const stems = new Map<string, string>();
    for (const stem of manifest.stems) {
      const match = files.find(
        (file) =>
          file === `${stem}${manifest.outputExtension}` ||
          (file.startsWith(`${stem}.`) && !file.endsWith('.notes.json')),
      );
      if (match) stems.set(stem, join(absoluteOutput, match));
    }
    const missing = manifest.stems.filter((stem) => !stems.has(stem));
    if (missing.length > 0) {
      throw new ApiError('STEMS_FAILED', `The plugin did not produce: ${missing.join(', ')}`);
    }

    const notes = new Map<string, StemNote[]>();
    for (const stem of manifest.transcribe ?? []) {
      const path = join(absoluteOutput, `${stem}.notes.json`);
      let raw: string;
      try {
        raw = await readFile(path, 'utf8');
      } catch {
        throw new ApiError('STEMS_FAILED', `The plugin did not transcribe: ${stem}`);
      }
      const parsed = NotesFileSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        throw new ApiError('STEMS_FAILED', `Invalid notes for: ${stem}`);
      }
      notes.set(stem, parsed.data.notes);
    }
    return { stems, notes };
  }

  private async manifest(): Promise<StemManifest> {
    let raw: string;
    try {
      raw = await readFile(join(this.directory, 'manifest.json'), 'utf8');
    } catch {
      throw new Error('manifest.json not found');
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('manifest.json is not valid JSON');
    }
    const parsed = ManifestSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('manifest.json is not valid');
    }
    return parsed.data;
  }
}
