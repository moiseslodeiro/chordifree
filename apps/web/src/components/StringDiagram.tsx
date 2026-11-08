import type { StringShape } from '../chords/shapes';

interface StringDiagramProps {
  shape: StringShape;
  label: string;
}

const INSTRUMENT_NAME = {
  guitar: 'Guitarra',
  ukelele: 'Ukelele',
} as const;

function describePositions(shape: StringShape): string {
  const parts = shape.frets.map((fret, index) => {
    const stringNumber = shape.strings - index;
    if (fret < 0) return `cuerda ${stringNumber} muda`;
    if (fret === 0) return `cuerda ${stringNumber} al aire`;
    return `cuerda ${stringNumber} traste ${fret}`;
  });
  return parts.join(', ');
}

export function StringDiagram({ shape, label }: StringDiagramProps) {
  const instrumentName = INSTRUMENT_NAME[shape.instrument];
  const stringGap = 20;
  const fretGap = 22;
  const left = 24;
  const top = 28;
  const bottom = 14;
  const width = left * 2 + (shape.strings - 1) * stringGap;
  const height = top + shape.fretCount * fretGap + bottom;
  const open = shape.baseFret === 0;

  const stringX = (index: number) => left + index * stringGap;
  const fretY = (index: number) => top + index * fretGap;

  return (
    <svg
      role="img"
      aria-label={`${instrumentName}: ${label}. ${describePositions(shape)}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="text-ink2"
    >
      {Array.from({ length: shape.strings }, (_, index) => (
        <line
          key={`string-${index}`}
          x1={stringX(index)}
          x2={stringX(index)}
          y1={top}
          y2={fretY(shape.fretCount)}
          stroke="currentColor"
          strokeWidth={1.2}
        />
      ))}

      {Array.from({ length: shape.fretCount + 1 }, (_, index) => (
        <line
          key={`fret-${index}`}
          x1={left}
          x2={stringX(shape.strings - 1)}
          y1={fretY(index)}
          y2={fretY(index)}
          stroke="currentColor"
          strokeWidth={open && index === 0 ? 4 : 1.2}
          strokeLinecap="round"
        />
      ))}

      {shape.baseFret > 0 ? (
        <text
          x={left - 8}
          y={top + fretGap * 0.72}
          textAnchor="end"
          fontSize={11}
          fill="currentColor"
        >
          {shape.baseFret}
        </text>
      ) : null}

      {shape.frets.map((fret, index) => {
        const x = stringX(index);
        if (fret < 0) {
          return (
            <text
              key={`marker-${index}`}
              x={x}
              y={top - 10}
              textAnchor="middle"
              fontSize={14}
              fill="currentColor"
            >
              ×
            </text>
          );
        }
        if (fret === 0) {
          return (
            <circle
              key={`marker-${index}`}
              cx={x}
              cy={top - 12}
              r={5}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
            />
          );
        }
        const y = top + (fret - shape.baseFret + 0.5) * fretGap;
        return (
          <circle
            key={`marker-${index}`}
            cx={x}
            cy={y}
            r={6.5}
            fill="rgb(var(--color-accent))"
            stroke="rgb(var(--color-panel))"
            strokeWidth={1}
          />
        );
      })}

      <text
        x={left}
        y={height - 2}
        fontSize={10}
        fill="currentColor"
        opacity={0.8}
      >
        {shape.instrument === 'guitar' ? 'E A D G B E' : 'G C E A'}
      </text>
      <title>{`${instrumentName}: ${label}. ${describePositions(shape)}`}</title>
    </svg>
  );
}
