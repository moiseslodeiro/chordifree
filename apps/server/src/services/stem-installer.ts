import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '../errors';

export type StemInstallStatus = 'running' | 'done' | 'error' | 'cancelled';
export type StemInstallStep = 'python' | 'files' | 'venv' | 'pip' | 'verify' | 'done';

export interface StemInstallJobView {
  id: string;
  status: StemInstallStatus;
  step: StemInstallStep;
  progress: number;
  message: string;
  detail?: string;
  /** Bounded installer output for the in-app console. */
  logs?: string[];
  error?: { code: string; message: string };
  startedAt: string;
  updatedAt: string;
}

export interface StemSetupStatus {
  supported: boolean;
  installed: boolean;
  /** True when Chordifree created the folder and can remove it. */
  managed: boolean;
  pluginDir?: string;
  python?: { command: string; version: string };
  job?: StemInstallJobView;
  error?: string;
}

export interface StemInstallerLike {
  status(): Promise<StemSetupStatus>;
  install(): Promise<StemInstallJobView>;
  cancel(): StemInstallJobView | null;
  getJob(): StemInstallJobView | null;
  uninstall(): Promise<void>;
}

export interface CommandResult {
  code: number;
  output: string;
}

export interface CommandOptions {
  signal?: AbortSignal;
  onLine?: (line: string) => void;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandOptions,
) => Promise<CommandResult>;

interface PythonCandidate {
  command: string;
  args: string[];
  version: string;
}

interface StoredJob {
  view: StemInstallJobView;
  controller: AbortController;
  python: PythonCandidate;
  logs: string[];
}

interface Marker {
  managedBy: 'chordifree';
  pluginVersion: string;
  installedAt: string;
  python: string;
  platform: string;
  arch: string;
}

export interface StemInstallerOptions {
  pluginDir: string;
  sourceDir: string;
  now?: () => number;
  run?: CommandRunner;
  pythonCandidates?: Array<{ command: string; args: string[] }>;
}

const PLUGIN_VERSION = '4.1.0';
const INSTALL_TIMEOUT_MS = 45 * 60 * 1000;
const PYTHON_CACHE_MS = 60 * 1000;
const SOURCE_FILES = ['separate.py', 'transcribe.py'] as const;
const MARKER_FILE = '.chordifree-stems.json';

// Exact versions: the installer runs pip on the user's machine, so a floating
// range would let a new or compromised release run with local privileges.
const REQUIREMENTS = `--extra-index-url https://download.pytorch.org/whl/cpu
torch==2.6.0
torchaudio==2.6.0
demucs==4.1.0
librosa==1.0.1
numpy==2.2.6
soundfile==0.14.0
`;

/** Default candidates: prefer a supported CPython, then fall back to PATH. */
function defaultPythonCandidates(): Array<{ command: string; args: string[] }> {
  if (process.platform === 'win32') {
    return [
      { command: 'py', args: ['-3.12'] },
      { command: 'py', args: ['-3.11'] },
      { command: 'py', args: ['-3.10'] },
      { command: 'python', args: [] },
      { command: 'python3', args: [] },
    ];
  }
  return ['python3.12', 'python3.11', 'python3.10', 'python3', 'python'].map((command) => ({
    command,
    args: [],
  }));
}

function tail(value: string, limit = 500): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `…${clean.slice(-limit)}` : clean;
}

/**
 * Runs a command and captures its output. The plugin installer only uses
 * fixed commands, never user input. On POSIX the child gets its own process
 * group so cancelling also stops pip and its build workers.
 */
export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const detached = process.platform !== 'win32';
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      detached,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    let pending = '';

    const emit = (chunk: string) => {
      output = `${output}${chunk}`;
      if (output.length > 20_000) output = output.slice(-20_000);
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const text = line.trim();
        if (text) options.onLine?.(text);
      }
    };

    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', abort);
      if (pending.trim()) options.onLine?.(pending.trim());
      resolve(result);
    };

    const kill = () => {
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

    const abort = () => {
      kill();
      finish({ code: 130, output: `${output}\ncancelled` });
    };

    child.stdout?.on('data', (chunk: Buffer) => emit(chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => emit(chunk.toString()));
    child.on('error', (error) => finish({ code: 127, output: `${output}\n${error.message}` }));
    child.on('close', (code) => finish({ code: code ?? 1, output }));

    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Installs the reference Demucs plugin inside an app-managed folder.
 *
 * It only copies scripts that ship with Chordifree and runs a fixed set of
 * commands (python -m venv, pip install, an import check). There is no URL or
 * shell input. The folder must be empty or previously created by this
 * installer, so an existing custom plugin is never overwritten.
 */
export class StemInstaller implements StemInstallerLike {
  private job: StoredJob | null = null;
  private pythonCache: { at: number; value: PythonCandidate | null } | null = null;
  private readonly run: CommandRunner;
  private readonly now: () => number;
  private readonly candidates: Array<{ command: string; args: string[] }>;

  constructor(private readonly options: StemInstallerOptions) {
    this.run = options.run ?? runCommand;
    this.now = options.now ?? Date.now;
    this.candidates = options.pythonCandidates ?? defaultPythonCandidates();
  }

  async status(): Promise<StemSetupStatus> {
    const supported = await this.sourceReady();
    const managed = this.markerPresent();
    const installed = supported && managed && (await this.installed());
    const python = supported ? await this.detectPython() : null;
    return {
      supported,
      installed,
      managed,
      pluginDir: this.options.pluginDir,
      ...(python ? { python: { command: python.command, version: python.version } } : {}),
      ...(this.job ? { job: this.job.view } : {}),
      ...(!supported ? { error: 'The bundled plugin source is missing.' } : {}),
    };
  }

  getJob(): StemInstallJobView | null {
    return this.job?.view ?? null;
  }

  async install(): Promise<StemInstallJobView> {
    if (this.job?.view.status === 'running') return this.job.view;
    if (!(await this.sourceReady())) {
      throw new ApiError('STEMS_SETUP_UNAVAILABLE', 'The bundled stems plugin is missing');
    }
    if (this.markerPresent() && (await this.installed())) {
      return this.finishedView();
    }
    await this.prepareDirectory();

    const python = await this.detectPython();
    if (!python) {
      throw new ApiError(
        'STEMS_SETUP_NO_PYTHON',
        'Python 3.10 to 3.13 is required to install the stems plugin',
      );
    }

    const timestamp = new Date(this.now()).toISOString();
    const job: StoredJob = {
      view: {
        id: randomUUID(),
        status: 'running',
        step: 'python',
        progress: 5,
        message: `Using Python ${python.version}`,
        startedAt: timestamp,
        updatedAt: timestamp,
      },
      controller: new AbortController(),
      python,
      logs: [],
    };
    this.job = job;
    this.log(job, '[1/5] python');
    void this.execute(job);
    return job.view;
  }

  cancel(): StemInstallJobView | null {
    const job = this.job;
    if (!job || job.view.status !== 'running') return job?.view ?? null;
    job.controller.abort();
    this.update(job, {
      status: 'cancelled',
      message: 'Installation cancelled',
    });
    return job.view;
  }

  async uninstall(): Promise<void> {
    if (this.job?.view.status === 'running') {
      throw new ApiError(
        'STEMS_SETUP_CONFLICT',
        'Cancel the running installation before uninstalling',
      );
    }
    if (!this.markerPresent()) {
      throw new ApiError(
        'STEMS_SETUP_NOT_MANAGED',
        'This plugin folder was not created by Chordifree',
      );
    }
    await rm(this.options.pluginDir, { recursive: true, force: true });
    this.job = null;
  }

  private async execute(job: StoredJob): Promise<void> {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      job.controller.abort();
    }, INSTALL_TIMEOUT_MS);
    try {
      await this.copyFiles(job);
      const venv = await this.createVenv(job);
      await this.installPackages(job, venv);
      await this.verify(job, venv);
      await this.writeMarker(job);
      await rm(join(this.options.pluginDir, '.cache'), { recursive: true, force: true });
      this.log(job, 'done');
      this.update(job, {
        status: 'done',
        step: 'done',
        progress: 100,
        message: 'Stems plugin installed',
        detail: undefined,
      });
    } catch (error) {
      const cancelled = job.controller.signal.aborted;
      if (cancelled) {
        await this.cleanupPartial();
        this.log(job, 'cancelled');
        this.update(job, {
          status: 'cancelled',
          message: timedOut ? 'Installation timed out; start it again' : 'Installation cancelled',
          detail: undefined,
        });
      } else {
        const message = error instanceof Error ? error.message : 'The installation failed';
        this.log(job, `error: ${message}`);
        this.update(job, {
          status: 'error',
          message: 'The stems plugin could not be installed',
          detail: tail(message),
          error: { code: 'STEMS_SETUP_FAILED', message: tail(message, 300) },
        });
        await this.cleanupPartial();
      }
    } finally {
      clearTimeout(timer);
    }
  }

  private async copyFiles(job: StoredJob): Promise<void> {
    this.log(job, '[2/5] plugin files');
    this.update(job, { step: 'files', progress: 12, message: 'Copying the plugin files' });
    const dir = this.options.pluginDir;
    await mkdir(dir, { recursive: true });
    for (const file of [...SOURCE_FILES, 'run.sh']) {
      const source = join(this.options.sourceDir, file);
      if (existsSync(source)) await copyFile(source, join(dir, file));
    }
    await writeFile(join(dir, 'requirements.txt'), REQUIREMENTS);
    // Keep the manifest out of the folder until the engine is verified: the
    // server treats its presence as "plugin available".
    await rm(join(dir, 'manifest.json'), { force: true });
    await rm(this.markerPath, { force: true });
  }

  private async createVenv(job: StoredJob): Promise<string> {
    this.assertActive(job);
    this.log(job, '[3/5] virtualenv');
    this.update(job, { step: 'venv', progress: 20, message: 'Creating the Python environment' });
    const venv = join(this.options.pluginDir, 'venv');
    await rm(venv, { recursive: true, force: true });
    const result = await this.run(job.python.command, [...job.python.args, '-m', 'venv', venv], {
      signal: job.controller.signal,
    });
    this.assertOk(result, 'Python could not create the virtualenv');
    const python = this.venvPython();
    if (!existsSync(python)) {
      throw new Error('The virtualenv did not contain a Python executable');
    }
    this.update(job, { progress: 30, message: 'Python environment ready' });
    return python;
  }

  private async installPackages(job: StoredJob, python: string): Promise<void> {
    this.assertActive(job);
    this.log(job, '[4/5] pip install');
    this.update(job, {
      step: 'pip',
      progress: 32,
      message: 'Downloading PyTorch and Demucs (about 1.5 GB)',
    });
    let progress = 32;
    const result = await this.run(
      python,
      [
        '-m',
        'pip',
        'install',
        '--disable-pip-version-check',
        '--no-input',
        '-r',
        join(this.options.pluginDir, 'requirements.txt'),
      ],
      {
        signal: job.controller.signal,
        env: {
          PIP_CACHE_DIR: join(this.options.pluginDir, '.cache', 'pip'),
          PIP_DISABLE_PIP_VERSION_CHECK: '1',
        },
        onLine: (line) => {
          this.log(job, line);
          if (line.startsWith('Downloading')) progress = Math.min(80, progress + 1);
          else if (line.startsWith('Installing collected packages')) progress = 86;
          else if (line.startsWith('Successfully installed')) progress = 92;
          this.update(job, {
            progress,
            message: 'Installing PyTorch and Demucs',
            detail: tail(line, 200),
          });
        },
      },
    );
    this.assertOk(result, 'pip could not install the stems dependencies');
    this.update(job, { progress: 92, message: 'Dependencies installed', detail: undefined });
  }

  private async verify(job: StoredJob, python: string): Promise<void> {
    this.assertActive(job);
    this.log(job, '[5/5] verify');
    this.update(job, { step: 'verify', progress: 95, message: 'Checking the installation' });
    const result = await this.run(
      python,
      ['-c', 'import torch, torchaudio, demucs, librosa, soundfile; print("ok")'],
      { signal: job.controller.signal },
    );
    this.assertOk(result, 'The installed packages could not be imported');
  }

  private async writeMarker(job: StoredJob): Promise<void> {
    await writeFile(
      join(this.options.pluginDir, 'manifest.json'),
      `${JSON.stringify(this.manifest(), null, 2)}\n`,
    );
    const marker: Marker = {
      managedBy: 'chordifree',
      pluginVersion: PLUGIN_VERSION,
      installedAt: new Date(this.now()).toISOString(),
      python: job.python.version,
      platform: process.platform,
      arch: process.arch,
    };
    await writeFile(this.markerPath, `${JSON.stringify(marker, null, 2)}\n`);
  }

  private async cleanupPartial(): Promise<void> {
    // Remove the whole managed folder: a half-installed plugin must not look
    // like a custom plugin on the next attempt.
    await rm(this.options.pluginDir, { recursive: true, force: true }).catch(() => undefined);
  }

  private assertOk(result: CommandResult, message: string): void {
    if (result.code === 0) return;
    throw new Error(`${message}: ${tail(result.output)}`);
  }

  private assertActive(job: StoredJob): void {
    if (job.controller.signal.aborted) throw new Error('Installation cancelled');
  }

  private async sourceReady(): Promise<boolean> {
    return SOURCE_FILES.every((file) => existsSync(join(this.options.sourceDir, file)));
  }

  private markerPresent(): boolean {
    return existsSync(this.markerPath);
  }

  private async installed(): Promise<boolean> {
    try {
      const marker = JSON.parse(await readFile(this.markerPath, 'utf8')) as Partial<Marker>;
      return (
        marker.managedBy === 'chordifree' &&
        existsSync(this.venvPython()) &&
        existsSync(join(this.options.pluginDir, 'manifest.json'))
      );
    } catch {
      return false;
    }
  }

  private get markerPath(): string {
    return join(this.options.pluginDir, MARKER_FILE);
  }

  private venvPython(): string {
    return process.platform === 'win32'
      ? join(this.options.pluginDir, 'venv', 'Scripts', 'python.exe')
      : join(this.options.pluginDir, 'venv', 'bin', 'python');
  }

  private manifest() {
    return {
      name: 'demucs-4stems',
      version: PLUGIN_VERSION,
      command: process.platform === 'win32' ? './venv/Scripts/python.exe' : './venv/bin/python',
      args: ['separate.py', '{input}', '{output}'],
      stems: ['vocals', 'drums', 'bass', 'other'],
      transcribe: ['bass', 'drums'],
      timeoutSeconds: 2400,
    };
  }

  private async prepareDirectory(): Promise<void> {
    const dir = this.options.pluginDir;
    if (existsSync(dir)) {
      const entries = await readdir(dir);
      if (entries.length > 0 && !this.markerPresent()) {
        throw new ApiError(
          'STEMS_SETUP_CONFLICT',
          'The plugin folder already contains files that Chordifree did not install',
        );
      }
    }
    await mkdir(dir, { recursive: true });
  }

  private async detectPython(): Promise<PythonCandidate | null> {
    const cached = this.pythonCache;
    if (cached && this.now() - cached.at < PYTHON_CACHE_MS) return cached.value;
    for (const candidate of this.candidates) {
      const result = await this.run(
        candidate.command,
        [...candidate.args, '-c', 'import sys; print(".".join(map(str, sys.version_info[:3])))'],
        {},
      );
      if (result.code !== 0) continue;
      const version = result.output.trim().split(/\r?\n/).pop()?.trim() ?? '';
      const [major, minor] = version.split('.').map(Number);
      if (major === 3 && (minor ?? 0) >= 10 && (minor ?? 0) <= 13) {
        const value = { ...candidate, version };
        this.pythonCache = { at: this.now(), value };
        return value;
      }
    }
    this.pythonCache = { at: this.now(), value: null };
    return null;
  }

  private finishedView(): StemInstallJobView {
    const timestamp = new Date(this.now()).toISOString();
    return {
      id: randomUUID(),
      status: 'done',
      step: 'done',
      progress: 100,
      message: 'Stems plugin installed',
      startedAt: timestamp,
      updatedAt: timestamp,
    };
  }

  private log(job: StoredJob, line: string): void {
    const text = line.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!text) return;
    job.logs.push(text);
    if (job.logs.length > 120) job.logs.splice(0, job.logs.length - 120);
  }

  private update(job: StoredJob, patch: Partial<StemInstallJobView>): void {
    job.view = {
      ...job.view,
      ...patch,
      logs: [...job.logs],
      updatedAt: new Date(this.now()).toISOString(),
    };
  }
}
