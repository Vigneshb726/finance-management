import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';
import Database from 'better-sqlite3-multiple-ciphers';
import { Kysely, migrateSqlite, pendingSqliteMigrations, SqliteDialect, sql, type Database as Schema } from '@finora/core';

/**
 * The desktop database: SQLite encrypted with SQLite3MultipleCiphers (ChaCha20-Poly1305).
 * A random 256-bit key is generated on first launch and stored only in encrypted form,
 * protected by the OS (Keychain on macOS, DPAPI on Windows, libsecret/KWallet on Linux)
 * through Electron's safeStorage.
 */

interface StoredKey {
  v: 1;
  protection: 'safeStorage' | 'plain';
  data: string;
}

export interface OpenedDatabase {
  db: Kysely<Schema>;
  sqlite: Database.Database;
  dbPath: string;
  keyProtection: string;
  appliedMigrations: string[];
  backupPath: string | null;
}

/** How the key is protected, for display ("keychain", "dpapi", "gnome_libsecret", "basic_text"…). */
function protectionLabel(): string {
  if (process.platform === 'darwin') return 'keychain';
  if (process.platform === 'win32') return 'dpapi';
  try {
    return safeStorage.getSelectedStorageBackend();
  } catch {
    return 'unknown';
  }
}

function loadOrCreateKey(keyPath: string): { key: string; protection: string } {
  if (fs.existsSync(keyPath)) {
    const stored = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as StoredKey;
    const key =
      stored.protection === 'safeStorage'
        ? safeStorage.decryptString(Buffer.from(stored.data, 'base64'))
        : Buffer.from(stored.data, 'base64').toString('utf8');
    return { key, protection: stored.protection === 'safeStorage' ? protectionLabel() : 'basic_text' };
  }

  const key = randomBytes(32).toString('hex');
  const canEncrypt = safeStorage.isEncryptionAvailable();
  const stored: StoredKey = canEncrypt
    ? { v: 1, protection: 'safeStorage', data: safeStorage.encryptString(key).toString('base64') }
    : { v: 1, protection: 'plain', data: Buffer.from(key, 'utf8').toString('base64') };
  // Written once, readable only by the current user
  fs.writeFileSync(keyPath, JSON.stringify(stored), { mode: 0o600 });
  return { key, protection: canEncrypt ? protectionLabel() : 'basic_text' };
}

/** Keeps the newest `keep` pre-upgrade copies. */
function pruneBackups(dir: string, keep = 5) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('finora-before-') && f.endsWith('.db'))
    .sort()
    .reverse();
  for (const file of files.slice(keep)) fs.rmSync(path.join(dir, file), { force: true });
}

export async function openDatabase(dataDir: string): Promise<OpenedDatabase> {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'finora.db');
  const { key, protection } = loadOrCreateKey(path.join(dataDir, 'finora.key'));

  const sqlite = new Database(dbPath);
  // The key is hex, so it can be embedded in the pragma safely
  sqlite.pragma(`key='${key}'`);
  try {
    sqlite.prepare('SELECT count(*) FROM sqlite_master').get();
  } catch (err) {
    sqlite.close();
    throw new Error(
      `The local database could not be unlocked (${(err as { code?: string }).code ?? 'error'}). ` +
        'If you restored files from another computer, restore a Finora backup file instead.',
    );
  }
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');

  const db = new Kysely<Schema>({ dialect: new SqliteDialect({ database: sqlite }) });

  // Before upgrading an existing database, keep an (equally encrypted) copy of it
  let backupPath: string | null = null;
  const pending = await pendingSqliteMigrations(db);
  const hasData = !!(await sql<{ n: number }>`SELECT count(*) AS n FROM "_migrations"`.execute(db)).rows[0]?.n;
  if (pending.length && hasData) {
    const backupDir = path.join(dataDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    backupPath = path.join(backupDir, `finora-before-${pending[0].id}-${Date.now()}.db`);
    // Flush the WAL, then copy the file byte-for-byte so the copy stays encrypted with the same key
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(dbPath, backupPath);
    pruneBackups(backupDir);
  }

  const appliedMigrations = await migrateSqlite(db);
  return { db, sqlite, dbPath, keyProtection: protection, appliedMigrations, backupPath };
}
