import { Capacitor } from '@capacitor/core';
import { desktopBridge } from '../../platform/bridge';
import { httpApi } from './http';
import type { BackendKind, FinanceApi } from './types';

let current: FinanceApi = httpApi;
let kind: BackendKind = 'web';

/**
 * Picks the data layer for this platform before the app renders. The offline
 * implementations are separate chunks, so the browser build never loads them.
 */
export async function initBackend(): Promise<BackendKind> {
  const bridge = desktopBridge();
  if (bridge) {
    const { createDesktopApi } = await import('./desktop');
    current = createDesktopApi(bridge);
    kind = 'desktop';
  } else if (Capacitor.isNativePlatform()) {
    const { createMobileApi } = await import('./mobile');
    current = await createMobileApi();
    kind = 'mobile';
  }
  return kind;
}

export const backend = (): FinanceApi => current;

/** 'web' talks to the server; 'desktop' and 'mobile' work fully offline on local SQLite. */
export const backendKind = (): BackendKind => kind;

export const isOfflineApp = () => kind !== 'web';

export type { BackendKind, FinanceApi } from './types';
