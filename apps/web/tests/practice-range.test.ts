import { describe, expect, it } from 'vitest';
import { barRangeAt, firstBeatAtOrAfter } from '../src/practice/range';

const beats = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

describe('barRangeAt', () => {
  it('devuelve el compás completo que contiene el instante', () => {
    expect(barRangeAt(0, beats, 4)).toEqual({ start: 0, end: 2 });
    expect(barRangeAt(1.2, beats, 4)).toEqual({ start: 0, end: 2 });
    expect(barRangeAt(2, beats, 4)).toEqual({ start: 2, end: 4 });
    expect(barRangeAt(4.9, beats, 4)).toEqual({ start: 4, end: 6 });
  });

  it('respeta compases de tres tiempos', () => {
    expect(barRangeAt(1.1, beats, 3)).toEqual({ start: 0, end: 1.5 });
    expect(barRangeAt(2.6, beats, 3)).toEqual({ start: 1.5, end: 3 });
  });

  it('estima el final del último compás con el intervalo mediano', () => {
    expect(barRangeAt(6.1, beats, 4)).toEqual({ start: 6, end: 8 });
    expect(barRangeAt(6.1, beats, 4, 7)).toEqual({ start: 6, end: 7 });
  });

  it('usa una ventana de cuatro segundos cuando no hay pulsos', () => {
    expect(barRangeAt(0, [], 4, 30)).toEqual({ start: 0, end: 4 });
    expect(barRangeAt(3.7, [], 4, 30)).toEqual({ start: 3, end: 7 });
    expect(barRangeAt(28, [], 4, 30)).toEqual({ start: 28, end: 30 });
    expect(barRangeAt(-2, [], 4)).toEqual({ start: 0, end: 4 });
  });
});

describe('firstBeatAtOrAfter', () => {
  it('encuentra el primer pulso igual o posterior', () => {
    expect(firstBeatAtOrAfter(beats, 0)).toBe(0);
    expect(firstBeatAtOrAfter(beats, 0.4)).toBe(1);
    expect(firstBeatAtOrAfter(beats, 0.5)).toBe(1);
    expect(firstBeatAtOrAfter(beats, 1.7)).toBe(4);
    expect(firstBeatAtOrAfter(beats, 6)).toBe(12);
  });

  it('devuelve -1 cuando no quedan pulsos', () => {
    expect(firstBeatAtOrAfter(beats, 6.1)).toBe(-1);
    expect(firstBeatAtOrAfter([], 0)).toBe(-1);
  });
});
