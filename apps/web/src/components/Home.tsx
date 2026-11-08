import { useMemo, useRef, useState } from 'react';
import type { Preferences, Song } from '../types';
import { songFromResult } from '../types';
import { createUploadAnalysis, createYoutubeAnalysis, sha256File } from '../lib/api';
import { useAnalysisRunner } from '../lib/useAnalysis';
import { videoIdFromUrl } from '../lib/youtube';
import { AnalysisCache } from '../storage/library';
import type { StorageLike } from '../storage/keys';
import { ErrorBanner, NoticeBanner } from './ErrorBanner';
import { ProgressPanel } from './ProgressPanel';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4'];

interface HomeProps {
  storage: StorageLike;
  preferences: Preferences;
  analyzerVersion: string;
  analyzerStatus: 'ok' | 'down' | 'unknown';
  libraryCount: number;
  notice: string | null;
  onDismissNotice: () => void;
  onOpenLibrary: () => void;
  onAnalyzed: (song: Song, audioUrl: string | null) => void;
}

interface Problem {
  code: string;
  message: string;
}

function extensionOf(name: string): string {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index + 1).toLowerCase() : '';
}

export function Home({
  storage,
  preferences,
  analyzerVersion,
  analyzerStatus,
  libraryCount,
  notice,
  onDismissNotice,
  onOpenLibrary,
  onAnalyzed,
}: HomeProps) {
  const cache = useMemo(() => new AnalysisCache(storage), [storage]);
  const runner = useAnalysisRunner();
  const [mode, setMode] = useState<'youtube' | 'upload'>('youtube');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  const busy = runner.state.phase === 'starting' || runner.state.phase === 'polling';
  const runnerError = runner.state.error;

  const submitYoutube = async () => {
    setProblem(null);
    retryRef.current = () => void submitYoutube();
    const videoId = videoIdFromUrl(url);
    if (!videoId) {
      setProblem({
        code: 'INVALID_URL',
        message:
          'Introduce un enlace válido de YouTube (youtube.com/watch?v=…, youtu.be/… o /shorts/…).',
      });
      return;
    }

    const cacheKey = `yt:${videoId}`;
    const cached = cache.get(cacheKey, analyzerVersion);
    if (cached) {
      onAnalyzed(songFromResult(cached, preferences), null);
      return;
    }

    const result = await runner.run((signal) => createYoutubeAnalysis(url, signal));
    if (!result) return;
    cache.set(cacheKey, analyzerVersion, result);
    onAnalyzed(songFromResult(result, preferences), null);
  };

  const submitUpload = async () => {
    setProblem(null);
    retryRef.current = () => void submitUpload();
    if (!file) {
      setProblem({ code: 'INVALID_AUDIO', message: 'Selecciona un archivo de audio.' });
      return;
    }
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
      setProblem({
        code: 'INVALID_AUDIO',
        message: 'Formato no admitido. Usa MP3, WAV, M4A, OGG, FLAC, WebM o MP4.',
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setProblem({
        code: 'FILE_TOO_LARGE',
        message: 'El archivo supera el límite de 25 MB.',
      });
      return;
    }

    const digest = await sha256File(file);
    const cacheKey = `upload:${file.name}:${digest}`;
    const cached = cache.get(cacheKey, analyzerVersion);
    if (cached) {
      const audioUrl = URL.createObjectURL(file);
      onAnalyzed(songFromResult(cached, preferences), audioUrl);
      return;
    }

    const result = await runner.run((signal) => createUploadAnalysis(file, signal));
    if (!result) return;
    cache.set(cacheKey, analyzerVersion, result);
    const audioUrl = URL.createObjectURL(file);
    onAnalyzed(songFromResult(result, preferences), audioUrl);
  };

  const submit = () => {
    if (mode === 'youtube') void submitYoutube();
    else void submitUpload();
  };

  return (
    <div className="space-y-6">
      {notice ? (
        <NoticeBanner message={notice} tone="warning" onDismiss={onDismissNotice} />
      ) : null}

      <section className="grid overflow-hidden rounded-2xl border border-line bg-panel shadow-lg lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.55fr)]">
        <div className="p-6 sm:p-8 lg:p-10 lg:pr-12">
          <p className="eyebrow">Análisis armónico</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">Analiza una canción</h1>
          <p className="mt-4 max-w-[47ch] text-sm leading-relaxed text-ink2 sm:text-base">
            Pega un enlace de YouTube o sube un audio. Detectaremos los acordes y los
            sincronizaremos con la reproducción.
          </p>

          <div className="mt-8 flex flex-wrap border-b border-line" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'youtube'}
              className="tab -mb-px mr-6 pb-2"
              onClick={() => setMode('youtube')}
            >
              Enlace de YouTube
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'upload'}
              className="tab -mb-px pb-2"
              onClick={() => setMode('upload')}
            >
              Archivo de audio
            </button>
          </div>

          <form
            className="mt-7 space-y-7"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {mode === 'youtube' ? (
              <div className="space-y-2">
                <label htmlFor="youtube-url" className="eyebrow block">
                  Enlace del video
                </label>
                <input
                  id="youtube-url"
                  type="url"
                  inputMode="url"
                  className="field"
                  placeholder="https://www.youtube.com/watch?v=…"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={busy}
                  autoComplete="off"
                />
                <p className="text-xs leading-relaxed text-ink3">
                  Se admiten `youtube.com/watch?v=`, `youtu.be/` y `youtube.com/shorts/`.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="audio-file" className="eyebrow block">
                  Archivo de audio
                </label>
                <input
                  id="audio-file"
                  type="file"
                  className="field file:mr-4 file:border file:border-line-strong file:bg-panel-2 file:px-3 file:py-1.5 file:font-mono file:text-[0.68rem] file:uppercase file:tracking-[0.12em] file:text-ink2"
                  accept=".mp3,.wav,.m4a,.ogg,.flac,.webm,.mp4,audio/*"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  disabled={busy}
                />
                <p className="text-xs leading-relaxed text-ink3">
                  MP3, WAV, M4A, OGG, FLAC, WebM o MP4 · máximo 25 MB y 15 minutos. El audio no se
                  guarda en la biblioteca.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Analizando…' : 'Detectar acordes'}
              </button>
              <button type="button" className="btn" onClick={onOpenLibrary}>
                Biblioteca ({libraryCount})
              </button>
            </div>
          </form>

          <div className="mt-7 space-y-4 empty:mt-0">
            <ProgressPanel state={runner.state} onCancel={runner.cancel} />

            {problem ? (
              <ErrorBanner
                code={problem.code}
                message={problem.message}
                onDismiss={() => setProblem(null)}
              />
            ) : null}

            {runnerError ? (
              <ErrorBanner
                code={runnerError.code}
                message={runnerError.message}
                onRetry={() => retryRef.current?.()}
                onDismiss={runner.reset}
              />
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col gap-8 border-t border-line bg-panel-2/50 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
          <div>
            <p className="eyebrow">Estado del analizador</p>
            <p className="mt-3 flex items-center gap-2 font-display text-xl font-bold leading-none text-ink">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  analyzerStatus === 'ok'
                    ? 'bg-positive'
                    : analyzerStatus === 'down'
                      ? 'bg-accent'
                      : 'bg-ink3'
                }`}
              />
              {analyzerStatus === 'ok'
                ? 'Disponible'
                : analyzerStatus === 'down'
                  ? 'No disponible'
                  : 'Comprobando'}
            </p>
            <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink3">
              Essentia · {analyzerVersion}
            </p>
          </div>

          <div>
            <p className="eyebrow">Cómo funciona</p>
            <ol className="mt-3 space-y-3">
              {[
                ['01', 'Elige la fuente', 'Un enlace de YouTube o un archivo de audio propio.'],
                ['02', 'Detectamos', 'Pulsos, compás y acordes alineados con la reproducción.'],
                ['03', 'Corrige y guarda', 'Ajusta el cifrado y guárdalo en tu biblioteca local.'],
              ].map(([number, title, body]) => (
                <li key={number} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-[0.62rem] tracking-[0.1em] text-accent">
                    {number}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug text-ink">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink3">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="note note-info mt-auto text-xs leading-relaxed">
            <strong className="font-semibold text-ink">Aviso legal:</strong> descargar audio de
            YouTube puede contravenir sus Términos de Servicio. Usa la subida de archivo cuando no
            tengas derechos sobre el contenido. La detección es automática y puede contener errores;
            el editor permite corregirla.
          </div>
        </aside>
      </section>
    </div>
  );
}
