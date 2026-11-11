import { isSong } from '../storage/library';
import type { Song } from '../types';

const FORMAT = 'chordifree-song';
const VERSION = 1;
const GZIP = 'g';
const RAW = 'r';

/** Above this length, messaging apps start truncating the link. */
export const MAX_SHARE_URL = 20_000;

export class ShareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareError';
  }
}

interface SharePayload {
  format: typeof FORMAT;
  version: number;
  song: Omit<Song, 'id' | 'createdAt' | 'updatedAt' | 'detectedSegments'>;
}

function shareableSong(song: Song): SharePayload['song'] {
  const { id: _id, createdAt: _created, updatedAt: _updated, detectedSegments: _detected, ...rest } =
    song;
  return {
    ...rest,
    // Do not leak an upload's original filename through a public link.
    source:
      song.source.type === 'youtube'
        ? song.source
        : { type: 'upload', filename: 'shared audio' },
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function streamFromBytes(bytes: Uint8Array): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return collect(streamFromBytes(bytes).pipeThrough(new CompressionStream('gzip')));
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return collect(streamFromBytes(bytes).pipeThrough(new DecompressionStream('gzip')));
}

/** Serializes one song into a compact token for a share link. */
export async function encodeSongForShare(song: Song): Promise<string> {
  const payload: SharePayload = { format: FORMAT, version: VERSION, song: shareableSong(song) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));

  if (typeof CompressionStream !== 'undefined') {
    return `${GZIP}.${toBase64Url(await gzip(bytes))}`;
  }
  return `${RAW}.${toBase64Url(bytes)}`;
}

/** Reads a token produced by encodeSongForShare and returns a fresh song. */
export async function decodeSongFromToken(token: string): Promise<Song> {
  const separator = token.indexOf('.');
  if (separator <= 0) throw new ShareError('Malformed share token');

  const mode = token.slice(0, separator);
  const encoded = token.slice(separator + 1);
  if (mode !== GZIP && mode !== RAW) throw new ShareError('Unknown share format');

  let bytes = fromBase64Url(encoded);
  if (mode === GZIP) {
    if (typeof DecompressionStream === 'undefined') {
      throw new ShareError('This browser cannot open shared links');
    }
    bytes = await gunzip(bytes);
  }

  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ShareError('Invalid share payload');
  }

  if (typeof data !== 'object' || data === null) throw new ShareError('Invalid share payload');
  const payload = data as Partial<SharePayload>;
  if (payload.format !== FORMAT || payload.version !== VERSION || !payload.song) {
    throw new ShareError('Unsupported share format');
  }

  const now = new Date().toISOString();
  const candidate = {
    ...payload.song,
    id: crypto.randomUUID(),
    detectedSegments: payload.song.segments,
    createdAt: now,
    updatedAt: now,
  };

  if (!isSong(candidate)) throw new ShareError('Invalid song');
  return candidate;
}

export function buildShareUrl(token: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = `share=${token}`;
  return url.toString();
}

/** Plain text for chat apps and email, with a link back to Chordifree. */
export function buildShareMessage(
  title: string,
  chordSheet: string,
  url?: string | null,
): string {
  const lines = [title.trim(), '', chordSheet.trim(), ''];
  lines.push(
    url
      ? `Open in Chordifree: ${url}`
      : 'Chordifree: https://github.com/moiseslodeiro/chordifree',
  );
  return lines.join('\n');
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function telegramShareUrl(message: string, url?: string | null): string {
  const params = new URLSearchParams();
  params.set('url', url ?? 'https://github.com/moiseslodeiro/chordifree');
  params.set('text', message);
  return `https://t.me/share/url?${params.toString()}`;
}

export function emailShareUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * A link only makes sense when the sender and receiver use the same hosted
 * instance. On localhost or inside the desktop shell, share a file instead.
 */
export function canShareLinks(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return false;
  const host = window.location.hostname;
  return !['localhost', '127.0.0.1', '::1', '[::1]', ''].includes(host);
}
