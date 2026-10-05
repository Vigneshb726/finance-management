// Bundles the Electron main and preload scripts. The shared core (and Kysely/Zod)
// are compiled in from source, so the packaged app needs only one runtime
// dependency: the native SQLite driver.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const coreEntry = fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url));
const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: 'linked',
  external: ['electron', 'better-sqlite3-multiple-ciphers'],
  alias: { '@finora/core': coreEntry },
  logLevel: 'info',
};

await build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' });
// Sandboxed preload scripts must be a single file that only requires 'electron'
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js', external: ['electron'] });
