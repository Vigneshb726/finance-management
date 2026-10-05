// Copies the built React app (client/dist) into the desktop package as the renderer.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../../client/dist', import.meta.url));
const to = fileURLToPath(new URL('../renderer', import.meta.url));

if (!existsSync(`${from}/index.html`)) {
  console.error('client/dist is missing — run "npm run build -w client" first');
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
// The test-only screenshot helper never ships
cpSync(from, to, { recursive: true, filter: (src) => !src.endsWith('__shot.html') });
console.log(`Renderer copied to ${to}`);
