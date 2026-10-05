// Launches the built desktop app against a throwaway data folder, runs the in-app
// smoke test (see runSmokeTest in src/main.ts) and prints the results.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import electron from 'electron';

const work = mkdtempSync(path.join(tmpdir(), 'finora-smoke-'));
const out = process.argv[2] ?? work;
const env = { ...process.env, FINORA_SMOKE_OUT: out, FINORA_USER_DATA: path.join(work, 'user-data') };
delete env.ELECTRON_RUN_AS_NODE;

spawnSync(electron, ['.'], { env, stdio: 'inherit', timeout: 120_000 });

const results = JSON.parse(readFileSync(path.join(out, 'desktop-smoke.json'), 'utf8'));
console.log(JSON.stringify(results, null, 2));

// The database on disk must not contain readable SQLite headers or data
const db = readFileSync(path.join(work, 'user-data', 'data', 'finora.db'));
console.log('database file encrypted:', !db.subarray(0, 15).toString().startsWith('SQLite format') && !db.includes(Buffer.from('Biscuit')));
rmSync(work, { recursive: true, force: true });
process.exit(results.ok ? 0 : 1);
