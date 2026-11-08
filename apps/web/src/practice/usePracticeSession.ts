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

/** Carga y guarda el estado de práctica de una canción concreta. */
export function usePracticeSession(songId: string): PracticeSessionState {
  const [storage] = useState(getStorage);
  const [practice, setPractice] = useState<PracticeSession>(() =>
    loadPractice(storage, songId),
  );
  const practiceRef = useRef(practice);
  const songRef = useRef(songId);

  practiceRef.current = practice;
  songRef.current = songId;

  useEffect(() => {
    const next = loadPractice(storage, songId);
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
        // La práctica sigue usable aunque no se pueda persistir.
      }
    },
    [storage],
  );

  return { practice, updatePractice };
}
