import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  StemInstaller,
  type CommandOptions,
  type CommandResult,
  type CommandRunner,
} from '../src/services/stem-installer';

async function sourceDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'chordifree-stem-source-'));
  await writeFile(join(dir, 'separate.py'), 'print("separate")\n');
  await writeFile(join(dir, 'transcribe.py'), 'print("transcribe")\n');
  await writeFile(join(dir, 'run.sh'), '#!/bin/sh\n');
  return dir;
}

async function workDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'chordifree-stem-install-'));
}

function fakeRunner(options: { python?: boolean; onPip?: () => void } = {}): {
  run: CommandRunner;
  calls: Array<{ command: string; args: string[] }>;
} {
  const calls: Array<{ command: string; args: string[] }> = [];
  const run: CommandRunner = async (command, args, opts?: CommandOptions) => {
    calls.push({ command, args });
    if (args.includes('-c') && args.some((arg) => arg.includes('version_info'))) {
      return options.python === false
        ? { code: 127, output: 'not found' }
        : { code: 0, output: '3.12.3\n' };
    }
    if (args.includes('venv')) {
      const venv = args[args.length - 1]!;
      await mkdir(join(venv, 'bin'), { recursive: true });
      await writeFile(join(venv, 'bin', 'python'), '#!/bin/sh\n');
      return { code: 0, output: '' };
    }
    if (args.includes('install')) {
      options.onPip?.();
      opts?.onLine?.('Collecting torch');
      opts?.onLine?.('Downloading torch-2.15.0-cpu.whl');
      opts?.onLine?.('Installing collected packages: torch, demucs');
      opts?.onLine?.('Successfully installed demucs-4.1.0 torch-2.15.0');
      if (opts?.signal?.aborted) return { code: 130, output: 'cancelled' };
      return { code: 0, output: 'Successfully installed' };
    }
    if (args.some((arg) => arg.includes('import torch'))) {
      return { code: 0, output: 'ok\n' };
    }
    return { code: 0, output: '' };
  };
  return { run, calls };
}

async function waitFor<T>(read: () => T | undefined, timeoutMs = 3000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for the installer');
}

describe('StemInstaller', () => {
  it('copies the plugin, creates the venv and writes a managed marker', async () => {
    const source = await sourceDir();
    const pluginDir = join(await workDir(), 'stems');
    const { run, calls } = fakeRunner();
    const installer = new StemInstaller({ pluginDir, sourceDir: source, run });

    const before = await installer.status();
    expect(before.supported).toBe(true);
    expect(before.installed).toBe(false);
    expect(before.python?.version).toBe('3.12.3');

    const started = await installer.install();
    expect(started.status).toBe('running');
    const finished = await waitFor(() =>
      installer.getJob()?.status === 'done' ? installer.getJob() : undefined,
    );
    expect(finished?.progress).toBe(100);

    const after = await installer.status();
    expect(after.installed).toBe(true);
    expect(after.managed).toBe(true);

    const manifest = JSON.parse(await readFile(join(pluginDir, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({
      name: 'demucs-4stems',
      args: ['separate.py', '{input}', '{output}'],
      transcribe: ['bass', 'drums'],
    });
    expect(manifest.command).toMatch(/venv\/bin\/python$/);
    expect(await readFile(join(pluginDir, 'requirements.txt'), 'utf8')).toContain(
      'download.pytorch.org/whl/cpu',
    );
    expect(existsSync(join(pluginDir, '.chordifree-stems.json'))).toBe(true);
    expect(calls.some((call) => call.args.includes('venv'))).toBe(true);

    await installer.uninstall();
    expect(existsSync(pluginDir)).toBe(false);
    const removed = await installer.status();
    expect(removed.installed).toBe(false);
  });

  it('refuses to overwrite a folder it did not create', async () => {
    const source = await sourceDir();
    const pluginDir = join(await workDir(), 'stems');
    await mkdir(pluginDir, { recursive: true });
    await writeFile(join(pluginDir, 'manifest.json'), '{"custom":true}');
    const { run } = fakeRunner();
    const installer = new StemInstaller({ pluginDir, sourceDir: source, run });

    await expect(installer.install()).rejects.toMatchObject({
      code: 'STEMS_SETUP_CONFLICT',
    });
  });

  it('reports when Python is missing', async () => {
    const source = await sourceDir();
    const pluginDir = join(await workDir(), 'stems');
    const { run } = fakeRunner({ python: false });
    const installer = new StemInstaller({ pluginDir, sourceDir: source, run });

    await expect(installer.install()).rejects.toMatchObject({
      code: 'STEMS_SETUP_NO_PYTHON',
    });
  });

  it('cancels an installation and cleans the partial folder', async () => {
    const source = await sourceDir();
    const pluginDir = join(await workDir(), 'stems');
    let reachedPip: (() => void) | undefined;
    const pipStarted = new Promise<void>((resolve) => {
      reachedPip = resolve;
    });
    const base = fakeRunner({ onPip: () => reachedPip?.() });
    const run: CommandRunner = async (command, args, opts): Promise<CommandResult> => {
      if (args.includes('install')) {
        reachedPip?.();
        return new Promise((resolve) => {
          const abort = () => resolve({ code: 130, output: 'cancelled' });
          if (opts?.signal?.aborted) abort();
          else opts?.signal?.addEventListener('abort', abort, { once: true });
        });
      }
      return base.run(command, args, opts);
    };
    const installer = new StemInstaller({ pluginDir, sourceDir: source, run });

    await installer.install();
    await pipStarted;
    expect(installer.getJob()?.step).toBe('pip');
    installer.cancel();
    const cancelled = await waitFor(() =>
      installer.getJob()?.status === 'cancelled' ? installer.getJob() : undefined,
    );
    expect(cancelled?.status).toBe('cancelled');
    await waitFor(() => (existsSync(pluginDir) ? undefined : true));
    expect(existsSync(pluginDir)).toBe(false);
  });
});
