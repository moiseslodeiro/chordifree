import { describe, expect, it } from 'vitest';
import { extractVideoId, isVideoId } from '../src/youtube';
import { ApiError } from '../src/errors';

describe('extractVideoId', () => {
  it('acepta los formatos habituales de YouTube', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('rechaza hosts que no son YouTube', () => {
    expect(() => extractVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_HOST' }),
    );
    expect(() => extractVideoId('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_HOST' }),
    );
  });

  it('rechaza enlaces sin identificador', () => {
    expect(() => extractVideoId('https://www.youtube.com/watch')).toThrowError(
      expect.objectContaining({ code: 'MISSING_VIDEO_ID' }),
    );
    expect(() => extractVideoId('https://www.youtube.com/watch?v=')).toThrowError(
      expect.objectContaining({ code: 'MISSING_VIDEO_ID' }),
    );
  });

  it('rechaza identificadores con formato inválido', () => {
    expect(() => extractVideoId('https://youtu.be/abc')).toThrowError(
      expect.objectContaining({ code: 'INVALID_URL' }),
    );
    expect(() => extractVideoId('https://www.youtube.com/watch?v=../../etc/passwd')).toThrowError(
      expect.objectContaining({ code: 'INVALID_URL' }),
    );
  });

  it('rechaza esquemas y URLs malformadas', () => {
    expect(() => extractVideoId('ftp://youtube.com/watch?v=dQw4w9WgXcQ')).toThrowError(ApiError);
    expect(() => extractVideoId('no es una url')).toThrowError(
      expect.objectContaining({ code: 'INVALID_URL' }),
    );
  });

  it('valida identificadores sueltos', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('corto')).toBe(false);
  });
});
