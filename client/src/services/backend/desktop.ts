import type { DesktopBridge } from '../../platform/bridge';
import type { FinanceApi } from './types';

/** Re-creates the main process's error so the UI can read its status and field errors. */
function apiError(status: number, body: { message: string; errors?: { field: string; message: string }[] }) {
  return Object.assign(new Error(body.message), { name: 'ApiError' as const, status, body });
}

/**
 * Desktop build: every call is forwarded over IPC to the Electron main process,
 * which runs the shared core against the encrypted local SQLite database.
 */
export function createDesktopApi(bridge: DesktopBridge): FinanceApi {
  const call = async (method: string, args: unknown[]) => {
    const result = await bridge.invoke(method, args);
    if (!result.ok) throw apiError(result.status, result.body);
    return result.data;
  };
  const group = (name: string) =>
    new Proxy(
      {},
      { get: (_target, method) => (...args: unknown[]) => call(`${name}.${String(method)}`, args) },
    );
  return new Proxy({} as FinanceApi, { get: (_target, name) => group(String(name)) });
}
