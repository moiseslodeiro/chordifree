import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

export interface StemSeparationResult {
  /** Stem name -> absolute file path. */
  stems: Map<string, string>;
}

export interface StemEngine {
  status(): Promise<StemEngineStatus>;
  separate(inputPath: string, outputDir: string): Promise<StemSeparationResult>;
}

/** Local mode without a plugin: the API reports the feature as unavailable. */
export class NullStemEngine implements StemEngine {
  async status(): Promise<StemEngineStatus> {
    return { available: false };
  }

  async separate(_inputPath: string, _outputDir: string): Promise<StemSeparationResult> {
    throw new ApiError(
      'STEMS_UNAVAILABLE',
      'The stems plugin is not installed. See docs/STEMS_PLUGIN.md.',
    );
  }
}

function substitute(args: string[], input: string, output: string): string[] {
  return args.map((arg) => arg.replaceAll('{input}', input).replaceAll('{output}', output));
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

  async separate(inputPath: string, outputDir: string): Promise<StemSeparationResult> {
    const manifest = await this.manifest();
    if (!manifest.args.some((arg) => arg.includes('{input}'))) {
      throw new ApiError('STEMS_FAILED', 'The plugin manifest does not use {input}');
    }
    if (!manifest.args.some((arg) => arg.includes('{output}'))) {
      throw new ApiError('STEMS_FAILED', 'The plugin manifest does not use {output}');
    }
    await mkdir(outputDir, { recursive: true });

    const stderr: string[] = [];
    const timeoutMs = (manifest.timeoutSeconds ?? 900) * 1000;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(manifest.command, substitute(manifest.args, inputPath, outputDir), {
        cwd: this.directory,
        shell: false,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new ApiError('STEMS_TIMEOUT', 'The stems plugin took too long'));
      }, timeoutMs);
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderr.length < 40) stderr.push(chunk.toString());
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new ApiError('STEMS_FAILED', error.message));
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code === 0) resolve();
        else {
          const detail = stderr.join('').trim().slice(-400);
          reject(
            new ApiError('STEMS_FAILED', detail || `The stems plugin exited with code ${code}`),
          );
        }
      });
    });

    const files = await readdir(outputDir);
    const stems = new Map<string, string>();
    for (const stem of manifest.stems) {
      const match = files.find(
        (file) => file === `${stem}${manifest.outputExtension}` || file.startsWith(`${stem}.`),
      );
      if (match) stems.set(stem, join(outputDir, match));
    }
    const missing = manifest.stems.filter((stem) => !stems.has(stem));
    if (missing.length > 0) {
      throw new ApiError('STEMS_FAILED', `The plugin did not produce: ${missing.join(', ')}`);
    }
    return { stems };
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
