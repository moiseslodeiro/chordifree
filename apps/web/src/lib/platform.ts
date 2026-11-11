export interface DesktopBridge {
  isDesktop?: boolean;
  platform?: string;
}

declare global {
  interface Window {
    chordifreeDesktop?: DesktopBridge;
  }
}

/** True when the web app is running inside the Electron shell. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && window.chordifreeDesktop?.isDesktop === true;
}
