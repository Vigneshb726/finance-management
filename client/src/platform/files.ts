import { Capacitor } from '@capacitor/core';
import { desktopBridge } from './bridge';

export interface SaveFileOptions {
  filename: string;
  data: string | Uint8Array;
  mimeType: string;
  /** Shown in the desktop Save dialog, e.g. { name: 'CSV file', extensions: ['csv'] } */
  filter: { name: string; extensions: string[] };
}

export type SaveResult = { status: 'saved'; location?: string } | { status: 'shared' } | { status: 'cancelled' };

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function download({ filename, data, mimeType }: SaveFileOptions) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Writes the file to the app's private cache, then opens the system share sheet (save to Files/Drive, email…). */
async function shareOnDevice({ filename, data }: SaveFileOptions): Promise<SaveResult> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const written = await Filesystem.writeFile({
    path: filename,
    directory: Directory.Cache,
    ...(typeof data === 'string' ? { data, encoding: Encoding.UTF8 } : { data: toBase64(data) }),
  });
  try {
    await Share.share({ title: filename, files: [written.uri], dialogTitle: `Save or send ${filename}` });
    return { status: 'shared' };
  } catch (err) {
    // Dismissing the share sheet rejects with a "canceled" error
    if (err instanceof Error && /cancel/i.test(err.message)) return { status: 'cancelled' };
    throw err;
  }
}

/** Saves a generated file the way each platform expects. */
export async function saveFile(options: SaveFileOptions): Promise<SaveResult> {
  const bridge = desktopBridge();
  if (bridge) {
    const result = await bridge.saveFile({ defaultName: options.filename, data: options.data, filters: [options.filter] });
    return result.saved ? { status: 'saved', location: result.path } : { status: 'cancelled' };
  }
  if (Capacitor.isNativePlatform()) return shareOnDevice(options);
  download(options);
  return { status: 'saved' };
}

/** Lets the user pick a file and returns its text (file inputs work in browsers, Electron and mobile WebViews). */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      file.text().then((text) => resolve({ name: file.name, text }), reject);
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Window printing works in browsers and on desktop; mobile WebViews print via the share sheet instead. */
export const canPrint = () => !Capacitor.isNativePlatform();
