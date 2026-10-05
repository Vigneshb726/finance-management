/**
 * Dev helper: renders a monthly report PDF from the running API.
 *   npx tsx scripts/render-report.ts <out.pdf> [email] [password]
 */
import { writeFileSync } from 'node:fs';
import { buildReportPdf } from '../src/utils/reportPdf';

const [out = 'report.pdf', email = 'demo@finance.app', password = 'Demo@1234'] = process.argv.slice(2);
const api = process.env.API_URL ?? 'http://localhost:5000/api';

const login = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}).then((r) => r.json());

const now = new Date();
const report = await fetch(`${api}/reports/monthly?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`, {
  headers: { Authorization: `Bearer ${login.token}` },
}).then((r) => r.json());

const { filename, bytes } = buildReportPdf(report);
writeFileSync(out, bytes);
console.log(`${filename} → ${out} (${bytes.length} bytes)`);
