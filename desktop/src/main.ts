import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell, type IpcMainInvokeEvent } from 'electron';
import {
  createContext,
  createLocalApi,
  createPbkdf2Hasher,
  invokeLocalApi,
  normalizeError,
  type LocalApi,
  type SessionStore,
} from '@finora/core';
import { openDatabase, type OpenedDatabase } from './database';

/**
 * Finora desktop (Windows / macOS / Linux). The React UI runs in a sandboxed
 * renderer loaded from the app's own files over a private app:// scheme; all data
 * work happens here, in the main process, on the encrypted local SQLite database.
 */

const SCHEME = 'app';
const APP_ORIGIN = `${SCHEME}://finora`;
const DEV_URL = !app.isPackaged ? process.env.FINORA_DEV_URL : undefined;
const RENDERER_DIR = path.join(__dirname, '..', 'renderer');

// Content-Security-Policy for the bundled UI: everything from the app itself, nothing remote
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
]);

// Development only: isolated data folder and an automated smoke test (see scripts/smoke.mjs)
const SMOKE_OUT = !app.isPackaged ? process.env.FINORA_SMOKE_OUT : undefined;
if (!app.isPackaged && process.env.FINORA_USER_DATA) app.setPath('userData', process.env.FINORA_USER_DATA);

// One instance at a time — SQLite has a single writer
if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow: BrowserWindow | null = null;
let database: OpenedDatabase | null = null;
let api: LocalApi | null = null;

const isTrustedUrl = (url: string) => url.startsWith(`${APP_ORIGIN}/`) || (!!DEV_URL && url.startsWith(DEV_URL));

/** IPC calls are accepted only from our own top-level page. */
function assertTrustedSender(event: IpcMainInvokeEvent) {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame || !isTrustedUrl(frame.url)) {
    throw new Error('Blocked IPC call from an untrusted frame');
  }
}

/** Serves the bundled UI; unknown paths fall back to index.html (client-side routing). */
function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const decoded = decodeURIComponent(pathname);
    const target = path.normalize(path.join(RENDERER_DIR, decoded));
    // Never serve anything outside the renderer folder
    const safe = target.startsWith(RENDERER_DIR + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile();
    const file = safe ? target : path.join(RENDERER_DIR, 'index.html');
    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  });
}

/** Remembers which local account is signed in (an id, not a credential). */
function sessionStore(dataDir: string): SessionStore {
  const file = path.join(dataDir, 'session.json');
  return {
    get: async () => {
      try {
        return (JSON.parse(fs.readFileSync(file, 'utf8')) as { userId?: string }).userId ?? null;
      } catch {
        return null;
      }
    },
    set: async (userId) => {
      if (userId) fs.writeFileSync(file, JSON.stringify({ userId }), { mode: 0o600 });
      else fs.rmSync(file, { force: true });
    },
  };
}

function registerIpc(dataDir: string) {
  ipcMain.handle('finora:invoke', async (event, method: unknown, args: unknown) => {
    assertTrustedSender(event);
    if (!api || typeof method !== 'string' || !Array.isArray(args)) {
      return { ok: false, status: 400, body: { message: 'Invalid request' } };
    }
    try {
      // Unknown method names are rejected by invokeLocalApi's allow-list; inputs are validated with Zod
      return { ok: true, data: await invokeLocalApi(api, method, args) };
    } catch (err) {
      const e = err as { status?: number; body?: { message: string } };
      if (typeof e.status === 'number' && e.body) return { ok: false, status: e.status, body: e.body };
      console.error(err);
      const normalized = normalizeError(err);
      return { ok: false, status: normalized.status, body: normalized.body };
    }
  });

  ipcMain.handle('finora:save-file', async (event, options: unknown) => {
    assertTrustedSender(event);
    const o = options as { defaultName?: unknown; data?: unknown; filters?: unknown };
    const data = o?.data;
    if (typeof o?.defaultName !== 'string' || !(typeof data === 'string' || data instanceof Uint8Array)) {
      throw new Error('Invalid save request');
    }
    if ((typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength) > 200 * 1024 * 1024) {
      throw new Error('File is too large');
    }
    const filters = Array.isArray(o.filters)
      ? (o.filters as { name: unknown; extensions: unknown }[])
          .filter((f) => typeof f?.name === 'string' && Array.isArray(f.extensions))
          .map((f) => ({ name: String(f.name), extensions: (f.extensions as unknown[]).map(String) }))
      : [];
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: path.join(app.getPath('documents'), path.basename(o.defaultName)),
      filters,
    });
    if (result.canceled || !result.filePath) return { saved: false };
    fs.writeFileSync(result.filePath, typeof data === 'string' ? data : Buffer.from(data));
    return { saved: true, path: result.filePath };
  });

  ipcMain.handle('finora:info', (event) => {
    assertTrustedSender(event);
    return {
      version: app.getVersion(),
      platform: process.platform,
      dataPath: database?.dbPath ?? dataDir,
      encrypted: true,
      keyProtection: database?.keyProtection ?? 'unknown',
    };
  });

  ipcMain.handle('finora:show-data-folder', (event) => {
    assertTrustedSender(event);
    shell.showItemInFolder(database?.dbPath ?? dataDir);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 380,
    minHeight: 560,
    show: false,
    title: 'Finora',
    backgroundColor: '#0b1120',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  const contents = mainWindow.webContents;
  // No new windows; https links open in the system browser
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // The window never navigates away from the app
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  void mainWindow.loadURL(DEV_URL ?? `${APP_ORIGIN}/`);
  if (SMOKE_OUT) contents.once('did-finish-load', () => void runSmokeTest(mainWindow!, SMOKE_OUT));
}

/**
 * Exercises the real stack from inside the sandboxed page — preload bridge, IPC
 * allow-list, core services and the encrypted database — then captures the UI.
 */
async function runSmokeTest(win: BrowserWindow, outDir: string) {
  const results: Record<string, unknown> = {};
  try {
    const page = win.webContents;
    results.bridge = await page.executeJavaScript('typeof window.finoraDesktop + "/" + typeof window.require + "/" + typeof window.process');
    results.flow = await page.executeJavaScript(`(async () => {
      const call = async (m, ...a) => { const r = await window.finoraDesktop.invoke(m, a); if (!r.ok) throw new Error(m + ': ' + r.status + ' ' + r.body.message); return r.data; };
      const out = {};
      out.blocked = await window.finoraDesktop.invoke('constructor', []);
      out.unauthenticated = await window.finoraDesktop.invoke('transactions.list', [{}]);
      await call('auth.register', { name: 'Desktop Tester', email: 'desktop@example.com', password: 'Test@12345' });
      const cats = await call('categories.list');
      const food = cats.find((c) => c.name === 'Food');
      const today = new Date().toISOString().slice(0, 10);
      await call('transactions.create', { type: 'EXPENSE', amount: 0.1, categoryId: food.id, description: 'Chai', date: today });
      await call('transactions.create', { type: 'EXPENSE', amount: 0.2, categoryId: food.id, description: 'Biscuit', date: today });
      out.totals = (await call('transactions.list', {})).totals;
      out.invalid = await window.finoraDesktop.invoke('transactions.create', [{ type: 'EXPENSE', amount: -1 }]);
      out.csvRows = (await call('transactions.exportCsv', {})).content.trim().split('\\r\\n').length - 1;
      const backup = await call('backup.create');
      out.backupTx = backup.transactions.length;
      out.report = (await call('reports.monthly', { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })).summary.expenses;
      return out;
    })()`);
    results.info = await page.executeJavaScript('window.finoraDesktop.info()');
    // Reload so the UI picks up the session created above, then capture it
    page.reload();
    await new Promise((r) => page.once('did-finish-load', r));
    await new Promise((r) => setTimeout(r, 3000));
    const image = await page.capturePage();
    fs.writeFileSync(path.join(outDir, 'desktop-smoke.png'), image.toPNG());
    results.ok = true;
  } catch (err) {
    results.ok = false;
    results.error = err instanceof Error ? err.message : String(err);
  }
  fs.writeFileSync(path.join(outDir, 'desktop-smoke.json'), JSON.stringify(results, null, 2));
  app.quit();
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' as const }] : []),
      { role: 'fileMenu' },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }]),
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  );
}

app.on('second-instance', () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

app.whenReady().then(async () => {
  // Deny every permission request (camera, notifications, geolocation…) — none are needed
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  const dataDir = path.join(app.getPath('userData'), 'data');
  try {
    database = await openDatabase(dataDir);
  } catch (err) {
    dialog.showErrorBox('Finora could not open its database', err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }
  const ctx = createContext({ db: database.db, dialect: 'sqlite', hasher: createPbkdf2Hasher() });
  api = createLocalApi(ctx, sessionStore(dataDir), { onError: (err) => console.error(err) });

  registerAppProtocol();
  registerIpc(dataDir);
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  void database?.db.destroy();
});
