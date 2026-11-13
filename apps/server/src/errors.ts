export type ErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_HOST'
  | 'MISSING_VIDEO_ID'
  | 'DURATION_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'INVALID_AUDIO'
  | 'VIDEO_UNAVAILABLE'
  | 'ANALYSIS_FAILED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_MEDIA'
  | 'FORBIDDEN';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  INVALID_URL: 400,
  UNSUPPORTED_HOST: 400,
  MISSING_VIDEO_ID: 400,
  DURATION_EXCEEDED: 422,
  FILE_TOO_LARGE: 413,
  INVALID_AUDIO: 422,
  VIDEO_UNAVAILABLE: 422,
  ANALYSIS_FAILED: 502,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  UNSUPPORTED_MEDIA: 415,
  FORBIDDEN: 403,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError('ANALYSIS_FAILED', 'Unexpected analysis error');
}
