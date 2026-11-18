import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chord, ChordSegment } from '@chordifree/chords';
import {
  chordMatches,
  chromaFromSpectrum,
  detectChordFromChroma,
  type DetectedChord,
} from './chords';

export type MicStatus = 'idle' | 'requesting' | 'listening' | 'denied' | 'unsupported' | 'error';

interface MicPracticeOptions {
  enabled: boolean;
  songId: string;
  segments: ChordSegment[];
  currentIndex: number;
}

export interface MicPracticeState {
  status: MicStatus;
  detected: Chord | null;
  hits: ReadonlySet<number>;
  hit: boolean;
  reset: () => void;
}

const ANALYSIS_INTERVAL_MS = 120;
const MIN_RMS = 0.008;
const STABLE_FRAMES = 2;
const SILENCE_TIMEOUT_MS = 500;

interface StableCandidate {
  chord: Chord;
  count: number;
}

function errorStatus(error: unknown): MicStatus {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'denied';
  return 'error';
}

/**
 * Listens to the microphone and marks the current chord segment as hit once
 * the detected chord matches it. Audio never leaves the browser.
 */
export function useMicPractice({
  enabled,
  songId,
  segments,
  currentIndex,
}: MicPracticeOptions): MicPracticeState {
  const [status, setStatus] = useState<MicStatus>('idle');
  const [detected, setDetected] = useState<Chord | null>(null);
  const [hits, setHits] = useState<Set<number>>(() => new Set());

  const segmentsRef = useRef(segments);
  const indexRef = useRef(currentIndex);
  const hitsRef = useRef(hits);
  const lastCandidateRef = useRef(0);
  segmentsRef.current = segments;
  indexRef.current = currentIndex;
  hitsRef.current = hits;

  useEffect(() => {
    hitsRef.current = new Set();
    setHits(new Set());
  }, [songId]);

  const reset = useCallback(() => {
    hitsRef.current = new Set();
    setHits(new Set());
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setDetected(null);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let timer: number | null = null;
    let stable: StableCandidate | null = null;

    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      analyser = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (context) void context.close().catch(() => undefined);
      context = null;
    };

    const analyse = () => {
      if (!analyser || !context) return;

      const spectrum = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(spectrum);

      const waveform = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(waveform);
      let energy = 0;
      for (const sample of waveform) energy += sample * sample;
      const rms = Math.sqrt(energy / waveform.length);
      if (rms < MIN_RMS) {
        stable = null;
        if (performance.now() - lastCandidateRef.current > SILENCE_TIMEOUT_MS) {
          setDetected(null);
        }
        return;
      }

      const chroma = chromaFromSpectrum(spectrum, context.sampleRate, analyser.fftSize);
      const candidate: DetectedChord | null = detectChordFromChroma(chroma);

      if (!candidate) {
        stable = null;
        if (performance.now() - lastCandidateRef.current > SILENCE_TIMEOUT_MS) {
          setDetected(null);
        }
        return;
      }

      if (stable && chordMatches(stable.chord, candidate.chord)) {
        stable.count += 1;
      } else {
        stable = { chord: candidate.chord, count: 1 };
      }

      if (stable.count < STABLE_FRAMES) return;

      const stableChord = stable.chord;
      lastCandidateRef.current = performance.now();
      setDetected((previous) =>
        previous && previous.root === stableChord.root && previous.quality === stableChord.quality
          ? previous
          : stableChord,
      );

      const index = indexRef.current;
      const expected = segmentsRef.current[index]?.chord ?? null;
      if (expected && !hitsRef.current.has(index) && chordMatches(expected, stableChord)) {
        const next = new Set(hitsRef.current);
        next.add(index);
        hitsRef.current = next;
        setHits(next);
      }
    };

    void (async () => {
      setStatus('requesting');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.35;
        source.connect(analyser);
        await context.resume().catch(() => undefined);
        if (cancelled) return;

        setStatus('listening');
        timer = window.setInterval(analyse, ANALYSIS_INTERVAL_MS);
      } catch (error) {
        if (cancelled) return;
        stop();
        setStatus(errorStatus(error));
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled]);

  return {
    status,
    detected,
    hits,
    hit: hits.has(currentIndex),
    reset,
  };
}
