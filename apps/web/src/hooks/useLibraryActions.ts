import { useEffect, useState, type MutableRefObject } from 'react';
import { useT } from '../i18n';
import { createYoutubeAnalysis } from '../lib/api';
import { ChordProError, parseChordPro } from '../lib/chordpro';
import type { AnalysisRunner } from '../lib/useAnalysis';
import { removePractice } from '../storage/practice';
import { BackupError, downloadBackup, parseBackupSnapshot } from '../storage/backup';
import { clearAnalysisCache as clearCachedAnalyses, Library } from '../storage/library';
import { StorageQuotaError, type StorageLike } from '../storage/keys';
import type { AppNotice, Preferences, Song } from '../types';

export interface LibraryActionsOptions {
  library: Library;
  storage: StorageLike;
  preferences: Preferences;
  analysisRunner: AnalysisRunner;
  currentSongRef: MutableRefObject<Song | null>;
  setSong: (song: Song | null) => void;
  setSavedSong: (song: Song | null) => void;
  replaceAudioUrl: (url: string | null) => void;
  refreshLibrary: () => void;
  onNotice: (notice: AppNotice) => void;
}

export interface LibraryActions {
  reanalyzingId: string | null;
  reanalyzeProgress: number | null;
  saveSong: (song: Song) => void;
  deleteSong: (id: string) => void;
  exportLibrary: () => void;
  importLibrary: (file: File) => Promise<void>;
  clearAnalysisCache: () => void;
  reanalyzeSong: (song: Song) => Promise<void>;
}

export function useLibraryActions({
  library,
  storage,
  preferences,
  analysisRunner,
  currentSongRef,
  setSong,
  setSavedSong,
  replaceAudioUrl,
  refreshLibrary,
  onNotice,
}: LibraryActionsOptions): LibraryActions {
  const t = useT();
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  useEffect(() => {
    if (reanalyzingId === null) return;
    const progress = analysisRunner.state.view?.progress;
    if (progress === undefined) return;
    onNotice({
      message: t('app.reanalyzingProgress', { progress: Math.round(progress) }),
      tone: 'info',
    });
  }, [analysisRunner.state.view?.progress, reanalyzingId, onNotice, t]);

  const saveSong = (target: Song) => {
    try {
      library.save(target);
      currentSongRef.current = target;
      setSong(target);
      setSavedSong(target);
      refreshLibrary();
      onNotice({ message: t('app.songSaved'), tone: 'success' });
    } catch (error) {
      onNotice({
        message: error instanceof StorageQuotaError ? t('app.saveQuota') : t('app.saveFailed'),
        tone: 'warning',
      });
    }
  };

  const deleteSong = (id: string) => {
    library.remove(id);
    removePractice(storage, id);
    refreshLibrary();
    if (currentSongRef.current?.id === id) {
      currentSongRef.current = null;
      setSong(null);
      setSavedSong(null);
      replaceAudioUrl(null);
    }
    onNotice({ message: t('app.songDeleted'), tone: 'info' });
  };

  const exportLibrary = () => {
    const snapshot = library.exportSnapshot();
    if (snapshot.songs.length === 0) {
      onNotice({ message: t('app.exportEmpty'), tone: 'warning' });
      return;
    }
    downloadBackup(snapshot.songs);
    onNotice({
      message: t('app.exported', {
        count: snapshot.songs.length,
        label: snapshot.songs.length === 1 ? t('common.song') : t('common.songs'),
      }),
      tone: 'success',
    });
  };

  const clearAnalysisCache = () => {
    const removed = clearCachedAnalyses(storage);
    onNotice({ message: t('app.cacheCleared', { count: removed }), tone: 'info' });
  };

  const importLibrary = async (file: File) => {
    try {
      const text = await file.text();
      const trimmed = text.trimStart();
      const isJson = file.name.toLowerCase().endsWith('.json') || trimmed.startsWith('{"');

      if (!isJson) {
        const sheet = parseChordPro(text, file.name, preferences);
        library.importSongs([sheet]);
        refreshLibrary();
        onNotice({
          message: t('app.importedSheet', { title: sheet.title }),
          tone: 'success',
        });
        return;
      }

      const imported = parseBackupSnapshot(text);
      const result = library.importSnapshot(imported);
      refreshLibrary();
      onNotice({
        message: t('app.imported', {
          added: result.added,
          addedLabel: result.added === 1 ? t('app.newSong') : t('app.newSongs'),
          updated: result.updated,
          updatedLabel: result.updated === 1 ? t('app.updatedSong') : t('app.updatedSongs'),
        }),
        tone: 'success',
      });
    } catch (error) {
      onNotice({
        message:
          error instanceof BackupError || error instanceof ChordProError
            ? error.message
            : t('app.backupImportFailed'),
        tone: 'warning',
      });
    }
  };

  const reanalyzeSong = async (target: Song) => {
    const source = target.source;
    if (source.type !== 'youtube' || reanalyzingId !== null) return;
    setReanalyzingId(target.id);
    onNotice({ message: t('app.reanalyzingProgress', { progress: 0 }), tone: 'info' });
    const result = await analysisRunner.run((signal) =>
      createYoutubeAnalysis(`https://youtu.be/${source.videoId}`, signal, true),
    );
    setReanalyzingId(null);
    if (!result) {
      onNotice({ message: t('app.reanalyzeFailed'), tone: 'warning' });
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
      lyricChordOffsets: undefined,
      lyricChordLines: undefined,
      updatedAt: new Date().toISOString(),
    };

    if (currentSongRef.current?.id === target.id) {
      currentSongRef.current = updated;
      setSong(updated);
    }
    try {
      library.save(updated);
      setSavedSong(updated);
      refreshLibrary();
      onNotice({ message: t('app.reanalyzed'), tone: 'success' });
    } catch {
      onNotice({ message: t('app.reanalyzedNotSaved'), tone: 'warning' });
    }
  };

  const reanalyzeProgress =
    reanalyzingId === null
      ? null
      : (analysisRunner.state.view?.progress ??
        (analysisRunner.state.phase === 'starting' ? 0 : null));

  return {
    reanalyzingId,
    reanalyzeProgress,
    saveSong,
    deleteSong,
    exportLibrary,
    importLibrary,
    clearAnalysisCache,
    reanalyzeSong,
  };
}
