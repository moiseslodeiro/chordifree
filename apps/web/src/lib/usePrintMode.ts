import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Mounts the print-only sheet only while the page is being printed.
 *
 * `beforeprint` fires when the user opens the print dialog, and the
 * `print` media query changes when a tool emulates print media (for
 * example, the E2E suite). Keeping the sheet out of the DOM the rest of
 * the time avoids duplicate text for assistive technology and tests.
 */
export function usePrintMode(): boolean {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const query =
      typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;

    const syncFromMedia = () => {
      setPrinting(query?.matches ?? false);
    };
    const beforePrint = () => {
      flushSync(() => setPrinting(true));
    };
    const afterPrint = () => {
      setPrinting(false);
    };

    query?.addEventListener('change', syncFromMedia);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    syncFromMedia();

    return () => {
      query?.removeEventListener('change', syncFromMedia);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  return printing;
}
