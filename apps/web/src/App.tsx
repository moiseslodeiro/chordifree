import { useCallback, useEffect, useRef, useState } from 'react';
import { getHealth } from './lib/api';
import { createYoutubeAnalysis } from './lib/api';
import { useAnalysisRunner } from './lib/useAnalysis';
import { useT, setLanguage } from './i18n';
import { Home } from './components/Home';
import { LibraryList } from './components/LibraryList';
import { SongView } from './components/SongView';
import { getStorage, PREFIX, StorageQuotaError } from './storage/keys';
import { listKeys } from './storage/envelope';
import { BackupError, downloadBackup, parseBackup } from './storage/backup';
import { Library } from './storage/library';
import { loadPreferences, savePreferences } from './storage/preferences';
import { removePractice } from './storage/practice';
import type { Preferences, Song } from './types';

type Route = { name: 'home' } | { name: 'library' } | { name: 'song'; id: string };

interface Notice {
  message: string;
  tone: 'info' | 'warning' | 'success';
}

function parseHash(): Route {
  if (typeof window === 'undefined') return { name: 'home' };
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === 'library') return { name: 'library' };
  const match = /^song\/(.+)$/.exec(hash);
  if (match?.[1]) return { name: 'song', id: decodeURIComponent(match[1]) };
  return { name: 'home' };
}

function hashFor(route: Route): string {
  if (route.name === 'library') return '#/library';
  if (route.name === 'song') return `#/song/${encodeURIComponent(route.id)}`;
  return '#/';
}

function hasQuarantinedData(storage: ReturnType<typeof getStorage>): boolean {
  return listKeys(storage, `${PREFIX}:corrupt:`).length > 0;
}

export default function App() {
  const t = useT();
  const [storage] = useState(getStorage);
  const [library] = useState(() => new Library(storage));
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences(storage));
  const analysisRunner = useAnalysisRunner();
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [initial] = useState(() => {
    const route = parseHash();
    if (route.name === 'song') {
      const found = library.get(route.id);
      if (found) return { route, song: found as Song | null };
      return { route: { name: 'home' } as Route, song: null };
    }
    return { route, song: null as Song | null };
  });
  const [route, setRoute] = useState<Route>(initial.route);
  const [song, setSong] = useState<Song | null>(initial.song);
  const songRef = useRef<Song | null>(initial.song);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [songs, setSongs] = useState(() => library.list());
  const [notice, setNotice] = useState<Notice | null>(() =>
    hasQuarantinedData(storage)
      ? {
          message: t('app.storageCorrupt'),
          tone: 'warning',
        }
      : null,
  );
  const [health, setHealth] = useState<{ status: 'ok' | 'down' | 'unknown'; version: string }>({
    status: 'unknown',
    version: 'essentia-1.6',
  });

  const forceFake =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('fakePlayer') === '1';

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  useEffect(() => {
    setLanguage(preferences.language);
  }, [preferences.language]);

  useEffect(() => {
    const controller = new AbortController();
    void getHealth(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setHealth({
        status: result.analyzer,
        version: result.analyzerVersion || 'essentia-1.6',
      });
    });
    return () => controller.abort();
  }, []);

  const replaceAudioUrl = useCallback((next: string | null) => {
    setAudioUrl((previous) => {
      if (previous && previous !== next) URL.revokeObjectURL(previous);
      return next;
    });
  }, []);

  const openSong = useCallback(
    (next: Song, nextAudioUrl: string | null) => {
      songRef.current = next;
      setSong(next);
      replaceAudioUrl(nextAudioUrl);
      const nextRoute: Route = { name: 'song', id: next.id };
      setRoute(nextRoute);
      if (window.location.hash !== hashFor(nextRoute)) {
        window.location.hash = hashFor(nextRoute);
      }
    },
    [replaceAudioUrl],
  );

  const applyRoute = useCallback(
    (next: Route) => {
      if (next.name === 'song') {
        const found = library.get(next.id);
        if (found) {
          songRef.current = found;
          setSong(found);
          replaceAudioUrl(null);
          setRoute(next);
          return;
        }
        if (songRef.current?.id === next.id) {
          setRoute(next);
          return;
        }
        setNotice({
          message: t('app.songMissing'),
          tone: 'warning',
        });
        setRoute({ name: 'library' });
        if (window.location.hash !== '#/library') window.location.hash = '#/library';
        return;
      }
      if (next.name === 'library') setSongs(library.list());
      setRoute(next);
    },
    [library, replaceAudioUrl],
  );

  useEffect(() => {
    const onHashChange = () => applyRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyRoute]);

  const navigate = (next: Route) => {
    if (window.location.hash !== hashFor(next)) window.location.hash = hashFor(next);
    applyRoute(next);
  };

  const updatePreferences = (patch: Partial<Preferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...patch };
      try {
        savePreferences(storage, next);
      } catch (error) {
        setNotice({
          message:
            error instanceof StorageQuotaError
              ? t('app.preferencesQuota')
              : t('app.preferencesFailed'),
          tone: 'warning',
        });
      }
      return next;
    });
  };

  const saveSong = (target: Song) => {
    try {
      library.save(target);
      songRef.current = target;
      setSong(target);
      setSongs(library.list());
      setNotice({ message: t('app.songSaved'), tone: 'success' });
    } catch (error) {
      setNotice({
        message:
          error instanceof StorageQuotaError
            ? t('app.saveQuota')
            : t('app.saveFailed'),
        tone: 'warning',
      });
    }
  };

  const deleteSong = (id: string) => {
    library.remove(id);
    removePractice(storage, id);
    setSongs(library.list());
    if (songRef.current?.id === id) {
      songRef.current = null;
      setSong(null);
      replaceAudioUrl(null);
    }
    setNotice({ message: t('app.songDeleted'), tone: 'info' });
  };

  const reanalyzeSong = async (target: Song) => {
    const source = target.source;
    if (source.type !== 'youtube' || reanalyzingId !== null) return;
    setReanalyzingId(target.id);
    const result = await analysisRunner.run((signal) =>
      createYoutubeAnalysis(`https://youtu.be/${source.videoId}`, signal),
    );
    setReanalyzingId(null);
    if (!result) {
      setNotice({ message: t('app.reanalyzeFailed'), tone: 'warning' });
      return;
    }

    const updated: Song = {
      ...target,
      segments: result.segments,
      detectedSegments: result.segments,
      beats: result.beats ?? [],
      beatsPerBar: result.beatsPerBar ?? 4,
      vocalRegions: result.vocalRegions ?? [],
      duration: result.duration,
      analyzerVersion: result.analyzerVersion,
      updatedAt: new Date().toISOString(),
    };

    if (songRef.current?.id === target.id) {
      songRef.current = updated;
      setSong(updated);
    }
    try {
      library.save(updated);
      setSongs(library.list());
      setNotice({ message: t('app.reanalyzed'), tone: 'success' });
    } catch {
      setNotice({
        message: t('app.reanalyzedNotSaved'),
        tone: 'warning',
      });
    }
  };

  const exportLibrary = () => {
    const all = library.exportSongs();
    if (all.length === 0) {
      setNotice({ message: t('app.exportEmpty'), tone: 'warning' });
      return;
    }
    downloadBackup(all);
    setNotice({
      message: t('app.exported', {
        count: all.length,
        label: all.length === 1 ? t('common.song') : t('common.songs'),
      }),
      tone: 'success',
    });
  };

  const importLibrary = async (file: File) => {
    try {
      const imported = parseBackup(await file.text());
      const result = library.importSongs(imported);
      setSongs(library.list());
      setNotice({
        message: t('app.imported', {
          added: result.added,
          addedLabel: result.added === 1 ? t('app.newSong') : t('app.newSongs'),
          updated: result.updated,
          updatedLabel: result.updated === 1 ? t('app.updatedSong') : t('app.updatedSongs'),
        }),
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        message:
          error instanceof BackupError ? error.message : t('app.backupImportFailed'),
        tone: 'warning',
      });
    }
  };

  return (
    <div className="shell">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line pb-4 sm:items-end">
        <button
          type="button"
          className="flex flex-col items-start gap-1.5 text-left"
          onClick={() => navigate({ name: 'home' })}
        >
          <img
            src="/brand-light.png"
            alt="chordifree"
            className="brand-light h-8 w-auto sm:h-9"
          />
          <img
            src="/brand-dark.png"
            alt="chordifree"
            className="brand-dark h-8 w-auto sm:h-9"
          />
          <span className="hidden font-mono text-[0.56rem] uppercase leading-none tracking-[0.16em] text-ink3 sm:block sm:text-[0.6rem]">
            {t('app.tagline')}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="badge hidden sm:inline-flex">{t('app.localOnly')}</span>
          <div className="flex items-center gap-1" role="group" aria-label={t('app.language')}>
            <button
              type="button"
              className={preferences.language === 'en' ? 'tool-chip-active' : 'tool-chip'}
              aria-pressed={preferences.language === 'en'}
              onClick={() => updatePreferences({ language: 'en' })}
            >
              EN
            </button>
            <button
              type="button"
              className={preferences.language === 'es' ? 'tool-chip-active' : 'tool-chip'}
              aria-pressed={preferences.language === 'es'}
              onClick={() => updatePreferences({ language: 'es' })}
            >
              ES
            </button>
          </div>
          <button
            type="button"
            className="btn min-h-0 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
            aria-pressed={preferences.theme === 'dark'}
            onClick={() =>
              updatePreferences({
                theme: preferences.theme === 'light' ? 'dark' : 'light',
              })
            }
          >
            {preferences.theme === 'light' ? t('app.themeLight') : t('app.themeDark')}
          </button>
        </div>
      </header>

      <main className="flex-1 py-7 sm:py-10">
        {route.name === 'home' ? (
          <Home
            storage={storage}
            preferences={preferences}
            analyzerVersion={health.version}
            analyzerStatus={health.status}
            libraryCount={songs.length}
            notice={notice?.message ?? null}
            onDismissNotice={() => setNotice(null)}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onAnalyzed={openSong}
          />
        ) : null}

        {route.name === 'library' ? (
          <LibraryList
            songs={songs}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            onExport={exportLibrary}
            onImport={(file) => void importLibrary(file)}
            onOpen={(id) => navigate({ name: 'song', id })}
            onDelete={deleteSong}
            onBack={() => navigate({ name: 'home' })}
            onHome={() => navigate({ name: 'home' })}
          />
        ) : null}

        {route.name === 'song' && song ? (
          <SongView
            song={song}
            audioUrl={audioUrl}
            forceFake={forceFake}
            saved={songs.some((item) => item.id === song.id)}
            simplifyChords={preferences.simplifyChords}
            reduceChords={preferences.reduceChords}
            reduceChordsMax={preferences.reduceChordsMax}
            instrument={preferences.instrument}
            gridView={preferences.gridView}
            notice={notice?.message ?? null}
            onDismissNotice={() => setNotice(null)}
            onChange={(next) => {
              songRef.current = next;
              setSong(next);
            }}
            onSave={saveSong}
            onReanalyze={() => void reanalyzeSong(song)}
            reanalyzing={reanalyzingId === song.id}
            reanalyzeProgress={
              reanalyzingId === song.id
                ? (analysisRunner.state.view?.progress ??
                  (analysisRunner.state.phase === 'starting' ? 0 : null))
                : null
            }
            onBack={() => navigate({ name: 'home' })}
            onOpenLibrary={() => navigate({ name: 'library' })}
            onPreferences={updatePreferences}
          />
        ) : null}
      </main>
    </div>
  );
}
