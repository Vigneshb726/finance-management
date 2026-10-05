/**
 * Optional password protection for backup files: AES-256-GCM with a key derived
 * by PBKDF2-SHA256 (Web Crypto — available in browsers, Electron and mobile WebViews).
 */
const ITERATIONS = 310_000;

export interface EncryptedBackup {
  app: 'finora';
  encrypted: true;
  format: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

const b64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const unb64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(json: string, password: string): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(json));
  return {
    app: 'finora',
    encrypted: true,
    format: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: b64(salt) },
    cipher: { name: 'AES-GCM', iv: b64(iv) },
    data: b64(new Uint8Array(data)),
  };
}

export const isEncryptedBackup = (value: unknown): value is EncryptedBackup =>
  !!value && typeof value === 'object' && (value as { encrypted?: unknown }).encrypted === true && 'data' in value;

export async function decryptBackup(file: EncryptedBackup, password: string): Promise<unknown> {
  const key = await deriveKey(password, unb64(file.kdf.salt), file.kdf.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.cipher.iv) }, key, unb64(file.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('Wrong password, or the backup file is damaged');
  }
}
