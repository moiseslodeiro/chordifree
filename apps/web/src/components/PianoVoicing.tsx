import {
  noteName,
  type Accidental,
  type Notation,
  type PitchClass,
} from '@chordifree/chords';
import type { PianoVoicing as PianoVoicingData } from '../chords/shapes';

interface PianoVoicingProps {
  voicing: PianoVoicingData;
  label: string;
  notation: Notation;
  accidental: Accidental;
}

const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function PianoVoicing({ voicing, label, notation, accidental }: PianoVoicingProps) {
  const noteNames = voicing.pitchClasses.map((pitchClass) =>
    noteName(pitchClass, notation, accidental),
  );
  const highlighted = new Set(voicing.pitchClasses);

  const whiteWidth = 18;
  const whiteHeight = 96;
  const blackWidth = 12;
  const blackHeight = 60;
  const octaves = 2;
  const whiteKeys = octaves * 7;
  const width = whiteKeys * whiteWidth;
  const height = whiteHeight;

  const white: Array<{ x: number; pitchClass: PitchClass }> = [];
  const black: Array<{ x: number; pitchClass: PitchClass }> = [];

  let whiteIndex = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      if (WHITE_PITCH_CLASSES.has(pitchClass)) {
        white.push({ x: whiteIndex * whiteWidth, pitchClass: pitchClass as PitchClass });
        whiteIndex += 1;
      } else if (BLACK_PITCH_CLASSES.has(pitchClass)) {
        black.push({
          x: whiteIndex * whiteWidth - blackWidth / 2,
          pitchClass: pitchClass as PitchClass,
        });
      }
    }
  }

  return (
    <svg
      role="img"
      aria-label={`Piano: ${label}. Notas: ${noteNames.join(', ')}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="text-ink2"
    >
      {white.map((key) => (
        <rect
          key={`white-${key.x}`}
          x={key.x}
          y={0}
          width={whiteWidth}
          height={whiteHeight}
          rx={1}
          fill={
            highlighted.has(key.pitchClass)
              ? 'rgb(var(--color-accent))'
              : 'rgb(var(--color-panel-2))'
          }
          stroke="rgb(var(--color-line-strong))"
          strokeWidth={1}
        />
      ))}
      {black.map((key) => (
        <rect
          key={`black-${key.x}`}
          x={key.x}
          y={0}
          width={blackWidth}
          height={blackHeight}
          rx={1}
          fill={
            highlighted.has(key.pitchClass)
              ? 'rgb(var(--color-accent-strong))'
              : 'rgb(var(--color-ink))'
          }
          stroke="rgb(var(--color-line-strong))"
          strokeWidth={1}
        />
      ))}
      <title>{`Piano: ${label}. Notas: ${noteNames.join(', ')}`}</title>
    </svg>
  );
}
