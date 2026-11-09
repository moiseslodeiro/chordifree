import { t, type MessageKey } from './index';

const API_ERROR_KEYS: Record<string, MessageKey> = {
  INVALID_URL: 'apiError.INVALID_URL',
  UNSUPPORTED_HOST: 'apiError.UNSUPPORTED_HOST',
  MISSING_VIDEO_ID: 'apiError.MISSING_VIDEO_ID',
  VIDEO_UNAVAILABLE: 'apiError.VIDEO_UNAVAILABLE',
  DURATION_EXCEEDED: 'apiError.DURATION_EXCEEDED',
  RATE_LIMITED: 'apiError.RATE_LIMITED',
  INVALID_AUDIO: 'apiError.INVALID_AUDIO',
  INVALID_REQUEST: 'apiError.INVALID_REQUEST',
  FILE_TOO_LARGE: 'apiError.FILE_TOO_LARGE',
  ANALYSIS_FAILED: 'apiError.ANALYSIS_FAILED',
  NOT_FOUND: 'apiError.NOT_FOUND',
  UNSUPPORTED_MEDIA: 'apiError.UNSUPPORTED_MEDIA',
};

/** Translate a known API error code, falling back to the server message. */
export function localizeApiError(code: string, fallback: string): string {
  const key = API_ERROR_KEYS[code];
  return key ? t(key) : fallback || t('apiError.UNKNOWN');
}
