import { useCallback, useEffect, useRef, useState } from 'react';
import { getStorage } from '../storage/keys';
import {
  loadPractice,
  normalizePractice,
  savePractice,
  type PracticeSession,
} from '../storage/practice';

interface PracticeSessionState {
  practice: PracticeSession;
  updatePractice: (patch: Partial<PracticeSession>) => void;
}

/**
 * Loads the practice state of a song. The A-B range and the metronome are
 * remembered, but every visit starts from the original tempo and pitch.
 */
function loadForOpen(storage: ReturnType<typeof getStorage>, songId: string): PracticeSession {
  return { ...loadPractice(storage, songId), rate: 1, pitch: 0 };
}

/** Loads and saves the practice state of a specific song. */
export function usePracticeSession(songId: string): PracticeSessionState {
  const [storage] = useState(getStorage);
  const [practice, setPractice] = useState<PracticeSession>(() => loadForOpen(storage, songId));
  const practiceRef = useRef(practice);
  const songRef = useRef(songId);

  practiceRef.current = practice;
  songRef.current = songId;

  useEffect(() => {
    const next = loadForOpen(storage, songId);
    practiceRef.current = next;
    setPractice(next);
  }, [songId, storage]);

  const updatePractice = useCallback(
    (patch: Partial<PracticeSession>) => {
      const next = normalizePractice({ ...practiceRef.current, ...patch });
      practiceRef.current = next;
      setPractice(next);
      try {
        savePractice(storage, songRef.current, next);
      } catch {
        // Practice remains usable even if it cannot be persisted.
      }
    },
    [storage],
  );

  return { practice, updatePractice };
}
