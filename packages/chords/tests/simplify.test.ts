import { describe, expect, it } from 'vitest';
import { simplifyChord, type Chord, type Quality } from '../src';

function chord(quality: Quality, root: Chord['root'] = 0, bass?: Chord['bass']): Chord {
  return bass === undefined ? { root, quality } : { root, quality, bass };
}

describe('simplifyChord', () => {
  it('reduce las familias mayores y las tensiones a la tríada mayor', () => {
    const qualities: Quality[] = [
      'major',
      'maj7',
      'maj9',
      '6',
      '6/9',
      'add9',
      '9',
      '11',
      '13',
      '7sus4',
      'sus2',
      'sus4',
    ];
    for (const quality of qualities) {
      expect(simplifyChord(chord(quality)).quality).toBe('major');
    }
  });

  it('conserva la séptima de dominante porque define la función armónica', () => {
    expect(simplifyChord(chord('7')).quality).toBe('7');
    expect(simplifyChord(chord('7', 7))).toMatchObject({ root: 7, quality: '7' });
  });

  it('reduce las familias menores a la tríada menor', () => {
    const qualities: Quality[] = ['minor', 'm7', 'm9', 'm11', 'm13', 'm6'];
    for (const quality of qualities) {
      expect(simplifyChord(chord(quality)).quality).toBe('minor');
    }
  });

  it('reduce los disminuidos y conserva los aumentados', () => {
    expect(simplifyChord(chord('dim')).quality).toBe('dim');
    expect(simplifyChord(chord('dim7')).quality).toBe('dim');
    expect(simplifyChord(chord('m7b5')).quality).toBe('dim');
    expect(simplifyChord(chord('aug')).quality).toBe('aug');
  });

  it('conserva el power chord y la fundamental', () => {
    const result = simplifyChord(chord('power', 7));
    expect(result).toEqual({ root: 7, quality: 'power' });
  });

  it('elimina el bajo invertido', () => {
    expect(simplifyChord(chord('major', 0, 7))).toEqual({ root: 0, quality: 'major' });
  });

  it('no modifica el acorde original y conserva raw', () => {
    const original: Chord = { root: 9, quality: 'm7', bass: 0, raw: 'Am7/C' };
    const result = simplifyChord(original);
    expect(original).toEqual({ root: 9, quality: 'm7', bass: 0, raw: 'Am7/C' });
    expect(result).toEqual({ root: 9, quality: 'minor', raw: 'Am7/C' });
  });

  it('cubre los casos de aceptación del cambio', () => {
    expect(simplifyChord(chord('maj7'))).toMatchObject({ root: 0, quality: 'major' });
    expect(simplifyChord(chord('m7', 9))).toMatchObject({ root: 9, quality: 'minor' });
    expect(simplifyChord(chord('dim7', 11))).toMatchObject({ root: 11, quality: 'dim' });
    expect(simplifyChord(chord('major', 0, 7))).toMatchObject({ root: 0, quality: 'major' });
    expect(simplifyChord(chord('power'))).toMatchObject({ root: 0, quality: 'power' });
  });
});
