import { contextBridge, ipcRenderer } from 'electron';

/**
 * The only bridge between the UI and the main process. The renderer is sandboxed
 * with context isolation, so it cannot reach Node.js or Electron directly — just
 * these four calls, each validated again in the main process.
 */
contextBridge.exposeInMainWorld('finoraDesktop', {
  invoke: (method: string, args: unknown[]) => ipcRenderer.invoke('finora:invoke', method, args),
  saveFile: (options: { defaultName: string; data: string | Uint8Array; filters: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('finora:save-file', options),
  info: () => ipcRenderer.invoke('finora:info'),
  showDataFolder: () => ipcRenderer.invoke('finora:show-data-folder'),
});
