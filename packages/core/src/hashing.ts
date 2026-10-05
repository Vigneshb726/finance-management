import type { PasswordHasher } from './context';

/**
 * PBKDF2-SHA256 password hashing using the Web Crypto API, which exists in every
 * runtime the offline apps use (Electron, Android/iOS WebViews, Node 20+).
 * Format: pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>
 */
const PREFIX = 'pbkdf2-sha256';
const DEFAULT_ITERATIONS = 210_000;
const KEY_BITS = 256;

interface SubtleLike {
  importKey(format: 'raw', key: Uint8Array, algorithm: 'PBKDF2', extractable: false, usages: ['deriveBits']): Promise<unknown>;
  deriveBits(
    algorithm: { name: 'PBKDF2'; hash: 'SHA-256'; salt: Uint8Array; iterations: number },
    key: unknown,
    length: number,
  ): Promise<ArrayBuffer>;
}

interface CryptoLike {
  subtle: SubtleLike;
  getRandomValues<T extends Uint8Array>(array: T): T;
}

const cryptoApi = (): CryptoLike => {
  const c = (globalThis as unknown as { crypto?: CryptoLike }).crypto;
  if (!c?.subtle) throw new Error('Web Crypto is not available in this environment');
  return c;
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const { subtle } = cryptoApi();
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

/** Constant-time comparison of two byte arrays. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function createPbkdf2Hasher(iterations = DEFAULT_ITERATIONS): PasswordHasher {
  return {
    async hash(password) {
      const salt = cryptoApi().getRandomValues(new Uint8Array(16));
      const hash = await derive(password, salt, iterations);
      return `${PREFIX}$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
    },
    async verify(password, stored) {
      const [prefix, iter, salt, hash] = stored.split('$');
      if (prefix !== PREFIX || !iter || !salt || !hash) return false;
      const actual = await derive(password, fromBase64(salt), Number(iter));
      return equalBytes(actual, fromBase64(hash));
    },
  };
}
