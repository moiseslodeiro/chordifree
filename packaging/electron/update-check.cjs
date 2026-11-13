'use strict';

const RELEASES_API = 'https://api.github.com/repos/moiseslodeiro/chordifree/releases/latest';
const RELEASE_PAGE = 'https://github.com/moiseslodeiro/chordifree/releases/tag/';
const TIMEOUT_MS = 10_000;

function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/^v/i, '').split('+')[0];
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(clean);
  if (!match) return null;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) {
      return a.numbers[index] > b.numbers[index] ? 1 : -1;
    }
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease.localeCompare(b.prerelease, undefined, { numeric: true });
}

function isNewerVersion(latest, current) {
  return compareVersions(latest, current) > 0;
}

function releaseUrlFor(tag) {
  return `${RELEASE_PAGE}${encodeURIComponent(tag)}`;
}

async function fetchLatestRelease(fetchImpl = globalThis.fetch, userAgent = 'Chordifree') {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(TIMEOUT_MS)
      : undefined;
  const response = await fetchImpl(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': userAgent,
    },
    ...(signal ? { signal } : {}),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
  const data = await response.json();
  if (!data || typeof data.tag_name !== 'string') return null;
  const tag = data.tag_name.trim();
  if (!parseVersion(tag)) return null;
  return { version: tag.replace(/^v/i, ''), tag, url: releaseUrlFor(tag) };
}

module.exports = {
  compareVersions,
  fetchLatestRelease,
  isNewerVersion,
  parseVersion,
  releaseUrlFor,
};
