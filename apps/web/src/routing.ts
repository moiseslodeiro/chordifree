export type Route =
  | { name: 'home' }
  | { name: 'library' }
  | { name: 'setlists' }
  | { name: 'setlist'; id: string }
  | { name: 'song'; id: string }
  | { name: 'admin' };

export function parseHash(): Route {
  if (typeof window === 'undefined') return { name: 'home' };
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === 'library') return { name: 'library' };
  if (hash === 'setlists') return { name: 'setlists' };
  if (hash === 'admin') return { name: 'admin' };
  const setlistMatch = /^setlist\/(.+)$/.exec(hash);
  if (setlistMatch?.[1]) return { name: 'setlist', id: decodeURIComponent(setlistMatch[1]) };
  const match = /^song\/(.+)$/.exec(hash);
  if (match?.[1]) return { name: 'song', id: decodeURIComponent(match[1]) };
  return { name: 'home' };
}

export function hashFor(route: Route): string {
  if (route.name === 'library') return '#/library';
  if (route.name === 'setlists') return '#/setlists';
  if (route.name === 'admin') return '#/admin';
  if (route.name === 'setlist') return `#/setlist/${encodeURIComponent(route.id)}`;
  if (route.name === 'song') return `#/song/${encodeURIComponent(route.id)}`;
  return '#/';
}
