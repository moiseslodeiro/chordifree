/**
 * Cleans lyrics that come from an automatic lookup: normalizes line endings,
 * trims each line and drops the empty ones so the editor and the lyric view do
 * not show gaps between verses.
 */
export function normalizeLyricsText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
