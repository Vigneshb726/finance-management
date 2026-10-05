/**
 * The narrow API the Electron preload script exposes to the renderer
 * (contextIsolation is on, so this is the only way to reach the main process).
 */
export type DesktopInvokeResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; body: { message: string; errors?: { field: string; message: string }[] } };

export interface DesktopInfo {
  version: string;
  platform: string;
  dataPath: string;
  encrypted: boolean;
  /** How the database key is protected (e.g. "keychain", "dpapi", "libsecret", or "basic_text" when no keyring exists). */
  keyProtection: string;
}

export interface DesktopBridge {
  invoke(method: string, args: unknown[]): Promise<DesktopInvokeResult>;
  saveFile(options: {
    defaultName: string;
    data: string | Uint8Array;
    filters: { name: string; extensions: string[] }[];
  }): Promise<{ saved: boolean; path?: string }>;
  info(): Promise<DesktopInfo>;
  showDataFolder(): Promise<void>;
}

declare global {
  interface Window {
    finoraDesktop?: DesktopBridge;
  }
}

export const desktopBridge = (): DesktopBridge | undefined => window.finoraDesktop;
