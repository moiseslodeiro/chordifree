import { ApiError } from './errors';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extrae y valida el identificador de un enlace de YouTube.
 * Nunca devuelve la URL original: el resto del sistema solo maneja el ID.
 */
export function extractVideoId(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ApiError('INVALID_URL', 'El enlace no es una URL válida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError('INVALID_URL', 'El enlace debe usar http o https');
  }

  const host = url.hostname.toLowerCase();
  const isYoutube = host === 'youtube.com' || host.endsWith('.youtube.com');
  const isShort = host === 'youtu.be' || host.endsWith('.youtu.be');
  if (!isYoutube && !isShort) {
    throw new ApiError('UNSUPPORTED_HOST', 'Solo se admiten enlaces de YouTube');
  }

  let candidate: string | null = null;
  if (isShort) {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (url.pathname === '/watch') {
    candidate = url.searchParams.get('v');
  } else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
    candidate = url.pathname.split('/')[2] ?? null;
  }

  if (!candidate) {
    throw new ApiError('MISSING_VIDEO_ID', 'El enlace de YouTube no incluye un identificador de video');
  }
  if (!VIDEO_ID_PATTERN.test(candidate)) {
    throw new ApiError('INVALID_URL', 'El identificador del video no tiene un formato válido');
  }
  return candidate;
}

export function isVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}
