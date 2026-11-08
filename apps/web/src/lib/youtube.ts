export function videoIdFromUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    const isYoutube = host === 'youtube.com' || host.endsWith('.youtube.com');
    const isShort = host === 'youtu.be' || host.endsWith('.youtu.be');
    if (!isYoutube && !isShort) return null;

    let candidate: string | null = null;
    if (isShort) candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
    else if (url.pathname === '/watch') candidate = url.searchParams.get('v');
    else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
      candidate = url.pathname.split('/')[2] ?? null;
    }

    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
