import { describe, expect, it } from 'vitest';
import { createDemoSong } from '../src/demo';
import {
  buildShareMessage,
  buildShareUrl,
  decodeSongFromToken,
  emailShareUrl,
  encodeSongForShare,
  telegramShareUrl,
  whatsappShareUrl,
} from '../src/lib/share';
import { DEFAULT_PREFERENCES } from '../src/storage/preferences';

describe('share tokens', () => {
  it('round-trips a song and regenerates identity fields', async () => {
    const song = createDemoSong(DEFAULT_PREFERENCES);
    const token = await encodeSongForShare(song);
    const decoded = await decodeSongFromToken(token);

    expect(decoded.title).toBe(song.title);
    expect(decoded.segments).toEqual(song.segments);
    expect(decoded.beats).toEqual(song.beats);
    expect(decoded.lyrics).toBe(song.lyrics);
    expect(decoded.id).not.toBe(song.id);
    expect(decoded.detectedSegments).toEqual(decoded.segments);
    expect(decoded.source).toEqual({ type: 'upload', filename: 'shared audio' });
  });

  it('does not leak the sender folder id in a share token', async () => {
    const song = { ...createDemoSong(DEFAULT_PREFERENCES), folderId: 'private-folder' };
    const decoded = await decodeSongFromToken(await encodeSongForShare(song));
    expect(decoded.folderId).toBeUndefined();
  });

  it('rejects a shared song whose payload expands beyond the limit', async () => {
    const large = {
      ...createDemoSong(DEFAULT_PREFERENCES),
      lyrics: 'A'.repeat(5 * 1024 * 1024),
    };
    const token = await encodeSongForShare(large);
    await expect(decodeSongFromToken(token)).rejects.toThrow('too large');
  });

  it('rejects malformed tokens', async () => {
    await expect(decodeSongFromToken('nope')).rejects.toThrow();
    await expect(decodeSongFromToken('g.bm90LWd6aXA')).rejects.toThrow();
  });

  it('builds a hash link without query parameters', async () => {
    const song = createDemoSong(DEFAULT_PREFERENCES);
    const token = await encodeSongForShare(song);
    const url = new URL(buildShareUrl(token));
    expect(url.hash).toBe(`#share=${token}`);
    expect(url.search).toBe('');
  });

  it('builds WhatsApp, Telegram and email targets with the chord sheet', () => {
    const message = buildShareMessage('Demo song', '[C]Hello\n[G]World', 'https://example.com/#share=abc');
    expect(message).toContain('[C]Hello');
    expect(message).toContain('https://example.com/#share=abc');

    const whatsapp = whatsappShareUrl(message);
    expect(whatsapp).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(whatsapp.split('text=')[1] ?? '')).toBe(message);

    const telegram = new URL(telegramShareUrl(message, 'https://example.com/#share=abc'));
    expect(`${telegram.origin}${telegram.pathname}`).toBe('https://t.me/share/url');
    expect(telegram.searchParams.get('url')).toBe('https://example.com/#share=abc');
    expect(telegram.searchParams.get('text')).toBe(message);

    const email = emailShareUrl('Demo song', message);
    expect(email.startsWith('mailto:?subject=Demo%20song&body=')).toBe(true);
    expect(decodeURIComponent(email.split('body=')[1] ?? '')).toBe(message);
  });
});
