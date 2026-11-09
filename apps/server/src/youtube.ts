import { ApiError } from './errors';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts and validates the identifier from a YouTube link.
 * Never returns the original URL: the rest of the system only handles the ID.
 */
export function extractVideoId(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ApiError('INVALID_URL', 'The link is not a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError('INVALID_URL', 'The link must use http or https');
  }

  const host = url.hostname.toLowerCase();
  const isYoutube = host === 'youtube.com' || host.endsWith('.youtube.com');
  const isShort = host === 'youtu.be' || host.endsWith('.youtu.be');
  if (!isYoutube && !isShort) {
    throw new ApiError('UNSUPPORTED_HOST', 'Only YouTube links are supported');
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
    throw new ApiError('MISSING_VIDEO_ID', 'The YouTube link does not include a video ID');
  }
  if (!VIDEO_ID_PATTERN.test(candidate)) {
    throw new ApiError('INVALID_URL', 'The video ID format is invalid');
  }
  return candidate;
}

export function isVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value);
}
