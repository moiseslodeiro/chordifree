import { useMemo, useRef, useState } from 'react';
import type { AppNotice, Preferences, Song } from '../types';
import { songFromResult } from '../types';
import { createUploadAnalysis, createYoutubeAnalysis, sha256File } from '../lib/api';
import { isDesktopApp } from '../lib/platform';
import { useAnalysisRunner } from '../lib/useAnalysis';
import { createDemoSong, DEMO_AUDIO_URL } from '../demo';
import { useT } from '../i18n';
import { isYoutubeRadio, videoIdFromUrl } from '../lib/youtube';
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
  notice: AppNotice | null;
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
  const t = useT();
  const desktop = isDesktopApp();
  const cache = useMemo(() => new AnalysisCache(storage), [storage]);
  const runner = useAnalysisRunner();
  const [mode, setMode] = useState<'youtube' | 'upload'>(desktop ? 'upload' : 'youtube');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  const busy = runner.state.phase === 'starting' || runner.state.phase === 'polling';
  const radioHint = mode === 'youtube' && isYoutubeRadio(url);
  const runnerError = runner.state.error;

  const guideSteps = desktop
    ? [
        ['01', t('home.desktopStep1Title'), t('home.desktopStep1Body')],
        ['02', t('home.desktopStep2Title'), t('home.desktopStep2Body')],
        ['03', t('home.desktopStep3Title'), t('home.desktopStep3Body')],
      ]
    : [
        ['01', t('home.step1Title'), t('home.step1Body')],
        ['02', t('home.step2Title'), t('home.step2Body')],
        ['03', t('home.step3Title'), t('home.step3Body')],
      ];

  const submitYoutube = async () => {
    setProblem(null);
    retryRef.current = () => void submitYoutube();
    const videoId = videoIdFromUrl(url);
    if (!videoId) {
      setProblem({
        code: 'INVALID_URL',
        message: t('home.invalidYoutube'),
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
      setProblem({ code: 'INVALID_AUDIO', message: t('home.selectFile') });
      return;
    }
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
      setProblem({
        code: 'INVALID_AUDIO',
        message: t('home.invalidFormat'),
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setProblem({
        code: 'FILE_TOO_LARGE',
        message: t('home.fileTooLarge'),
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
        <NoticeBanner message={notice.message} tone={notice.tone} onDismiss={onDismissNotice} />
      ) : null}

      <section className="grid overflow-hidden rounded-2xl border border-line bg-panel shadow-lg lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.55fr)]">
        <div className="p-6 sm:p-8 lg:p-10 lg:pr-12">
          <p className="eyebrow">{t('home.eyebrow')}</p>
          <h1 className="display mt-3 text-4xl sm:text-5xl">{t('home.title')}</h1>
          <p className="mt-4 max-w-[47ch] text-sm leading-relaxed text-ink2 sm:text-base">
            {t(desktop ? 'home.subtitleDesktop' : 'home.subtitle')}
          </p>

          <div className="mt-8 flex flex-wrap border-b border-line" role="tablist">
            {(desktop
              ? (['upload', 'youtube'] as const)
              : (['youtube', 'upload'] as const)
            ).map((value, index, list) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={`tab -mb-px pb-2 ${index < list.length - 1 ? 'mr-6' : ''}`}
                onClick={() => setMode(value)}
              >
                {value === 'upload' ? t('home.uploadTab') : t('home.youtubeTab')}
              </button>
            ))}
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
                  {t('home.youtubeLabel')}
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
                  {t('home.youtubeHelp')}
                </p>
                {radioHint ? (
                  <p className="text-xs leading-relaxed text-warning">{t('home.radioHint')}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="audio-file" className="eyebrow block">
                  {t('home.uploadLabel')}
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
                  {t('home.uploadHelp')}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? t('home.analyzing') : t('home.detect')}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => onAnalyzed(createDemoSong(preferences), DEMO_AUDIO_URL)}
              >
                {t('home.demo')}
              </button>
              <button type="button" className="btn" onClick={onOpenLibrary}>
                {t('home.library', { count: libraryCount })}
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
          {desktop ? (
            <div>
              <p className="eyebrow">{t('home.desktopLocalTitle')}</p>
              <p className="mt-3 flex items-center gap-2 font-display text-xl font-bold leading-none text-ink">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-positive" />
                {t('home.desktopLocalStatus')}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink3">
                {t('home.desktopLocalBody')}
              </p>
            </div>
          ) : (
            <div>
              <p className="eyebrow">{t('home.analyzerStatus')}</p>
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
                  ? t('home.available')
                  : analyzerStatus === 'down'
                    ? t('home.unavailable')
                    : t('home.checking')}
              </p>
              <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ink3">
                Essentia · {analyzerVersion}
              </p>
              {analyzerStatus === 'down' ? (
                <a
                  className="mt-2 inline-block text-xs text-accent underline decoration-line-strong underline-offset-4"
                  href="https://github.com/moiseslodeiro/chordifree#quick-start-with-docker"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('home.analyzerHelp')}
                </a>
              ) : null}
            </div>
          )}

          <div>
            <p className="eyebrow">{t('home.howItWorks')}</p>
            <ol className="mt-3 space-y-3">
              {guideSteps.map(([number, title, body]) => (
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

          {!desktop || mode === 'youtube' ? (
            <div className="note note-info mt-auto text-xs leading-relaxed">
              <strong className="font-semibold text-ink">{t('home.legalTitle')}</strong>{' '}
              {t('home.legalBody')}
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
