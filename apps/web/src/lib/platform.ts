export interface UpdateInfo {
  version: string;
  url: string;
}

export interface UpdateCheckResult {
  status: 'update' | 'current' | 'error' | 'disabled';
  version?: string;
  url?: string;
}

export interface DesktopBridge {
  isDesktop?: boolean;
  platform?: string;
  checkForUpdates?: () => Promise<UpdateCheckResult>;
  onUpdateAvailable?: (callback: (info: UpdateInfo) => void) => () => void;
  openExternal?: (url: string) => Promise<void> | void;
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
