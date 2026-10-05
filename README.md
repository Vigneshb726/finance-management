# Finora — Finance Management System

One personal finance application that runs:

| Where | How | Data |
|---|---|---|
| **Browser** | React web app + Express API (deployed on Render) | PostgreSQL, online account |
| **Windows / macOS / Linux** | Electron desktop app | Encrypted SQLite on the computer — **fully offline** |
| **Android / iOS** | Capacitor mobile app | Encrypted SQLite on the phone — **fully offline** |

Track income and expenses, recurring transactions, monthly and category budgets, savings goals, analytics, printable PDF reports, CSV export and backups. Every figure is computed from the database; nothing is hard-coded.

## Features

- **Authentication** — register / login / logout, password hashing (bcrypt on the server, PBKDF2 on devices), protected routes, profile, password change, account deletion. Web uses JWT; installed apps use local accounts on the device.
- **Dashboard** — total balance, monthly income / expenses / net savings with month-over-month change, budget and goal progress, charts, recent transactions, month switcher.
- **Transactions** — add / edit / delete; search, filters (type, category, payment method, dates), sorting, pagination, filtered totals; **CSV export** of the current filter.
- **Recurring transactions** — daily / weekly / monthly / yearly (every *N*), optional end date, pause / resume. Due occurrences are created automatically — including ones missed while the app was closed — exactly once.
- **Categories** — 10 default expense + 5 income categories; custom categories; deleting one moves its transactions to "Other".
- **Budgets** — monthly budget with category limits; spent, remaining, usage %, status (On track < 80% ≤ Near limit ≤ 100% < Exceeded).
- **Goals** — target, saved, target date, progress, required monthly saving, add / withdraw.
- **Analytics** — 3 / 6 / 12-month trends, income vs expenses, savings, category breakdowns, budget performance, data table.
- **Reports** — printable monthly report with a **PDF download** (share sheet on mobile): income, expenses, savings, category breakdown, budget performance, transaction summary, goals and the month's transactions. Generated on the device — works offline.
- **Backup & restore** — one JSON file with all data; optional password encryption (AES-256-GCM). A backup from any Finora app restores into any other (web ↔ desktop ↔ mobile).
- **Notifications** — budget near limit / exceeded, goal milestones, monthly summary.
- **Settings** — profile, currency (INR default), light / dark / system theme, notification preferences, data & backup, password, account.

## Architecture

```
                         packages/core  (@finora/core)
        validation (Zod) · calculations · services · migrations · CSV · backup · reports
        written once with Kysely — the same queries run on PostgreSQL and SQLite
                 ▲                          ▲                          ▲
     Express API │ (Node)        Electron  │ main process     Capacitor│ (inside the WebView)
                 │                          │                          │
     PostgreSQL (Render)        SQLite + SQLite3MultipleCiphers   SQLite + SQLCipher
                 ▲                          ▲ IPC (allow-listed)       ▲ direct calls
                 └────────────── client/  React UI (one codebase) ─────┘
                       services/backend picks HTTP / desktop / mobile at start-up
```

- **One implementation of the business logic.** `packages/core` holds every rule (budgets, goals, recurring, notifications, analytics, reports, backup). The server calls it over PostgreSQL; the desktop and mobile apps call it over SQLite. The UI talks to a `FinanceApi` interface with three implementations — `http`, `desktop` (IPC) and `mobile` (in-process) — and the TypeScript compiler checks that the offline implementation returns exactly the shapes the UI expects.
- **Money is stored as integer paise** in both databases (no floating-point drift); the API and UI work in rupees.
- **Dates** are `YYYY-MM-DD` text, timestamps ISO-8601 strings, ids are UUIDs — all portable between databases (and ready for a future sync feature).
- **Why not Prisma everywhere?** Prisma needs Node.js and its own query engine (it cannot run inside a phone's WebView) and one schema targets one database. Prisma is kept for **PostgreSQL migrations** only; queries go through Kysely.

## Project structure

```
finance-management/
├── packages/core/          shared domain logic (TypeScript, runs in Node, Electron and WebViews)
│   ├── src/services/       auth, transactions, recurring, categories, budgets, goals, notifications,
│   │                       analytics, reports, csv, backup
│   ├── src/db/             schema types, SQLite migrations, dialect helpers
│   ├── src/api/localApi.ts the offline API used by desktop and mobile
│   └── tests/              32 tests on in-memory SQLite (incl. schema-parity checks)
├── server/                 Express API (PostgreSQL) — thin controllers over core
│   ├── prisma/             schema.prisma + migrations (PostgreSQL) + seed
│   └── tests/              16 end-to-end API tests on PostgreSQL
├── client/                 React app — web, and the UI of the desktop and mobile apps
│   ├── src/services/backend/  http · desktop (IPC) · mobile (Capacitor SQLite driver)
│   ├── src/platform/       file save/share, desktop bridge types
│   ├── android/  ios/      Capacitor native projects
│   └── capacitor.config.ts
├── desktop/                Electron app (main process, preload bridge, encrypted DB, installers)
├── .github/workflows/      ci.yml (tests on every push) · build-apps.yml (installers in the cloud)
└── render.yaml             web deployment
```

## Run the web app locally

Prerequisites: Node.js 20+ and npm 10+. PostgreSQL 14+ **or** the bundled `npm run db:local`.

```bash
npm install
cp .env.example server/.env          # PowerShell: Copy-Item .env.example server\.env
npm run db:local                     # terminal 1 — only if you have no PostgreSQL (keep open)
npm run db:deploy                    # apply migrations
npm run db:seed                      # optional demo data
npm run dev                          # http://localhost:5173 (API on :5000)
```

`server/.env`: `DATABASE_URL`, `JWT_SECRET` (≥ 32 chars), `JWT_EXPIRES_IN`, `PORT`, `CLIENT_URL` — see `.env.example`.

Demo login (after seeding): **demo@finance.app / Demo@1234**.

## Desktop app (Windows / macOS / Linux)

```bash
npm install                 # once, at the repository root
npm run desktop:install     # once — installs Electron into desktop/
npm run desktop:start       # build and launch the app
npm run desktop:dist        # build an installer for the current OS → desktop/release/
```

- Data: `<user data>/Finora/data/finora.db` (Windows: `%APPDATA%\Finora`, macOS: `~/Library/Application Support/Finora`, Linux: `~/.config/Finora`). Settings → Data & backup shows the path.
- `npm run desktop:dev` runs the desktop shell against the Vite dev server (`npm run dev -w client`) with hot reload.
- `node desktop/scripts/smoke.mjs` runs an automated end-to-end test of the desktop shell (preload, IPC, database encryption) and saves a screenshot.

## Mobile apps (Android / iOS)

```bash
npm run mobile:sync          # build the web app and copy it into android/ and ios/
npm run mobile:android       # open in Android Studio (run on a device/emulator)
```

**No Mac needed:** iOS is built in the cloud by GitHub Actions (below). With a Mac you can also run `npm run mobile:ios` to open Xcode.

## Building the apps in the cloud (GitHub Actions)

`.github/workflows/build-apps.yml` builds everything on GitHub's machines:

1. Push the repository to GitHub.
2. **Actions → Build apps → Run workflow** (or push a tag such as `v1.0.0`, which also creates a GitHub Release with all files attached).
3. Download the artifacts:

| Artifact | Contents | Works without secrets |
|---|---|---|
| `finora-desktop-Windows` | `Finora-Setup-x.y.z.exe` | ✅ (unsigned — Windows SmartScreen warns) |
| `finora-desktop-macOS` | `.dmg` for Intel and Apple Silicon | ✅ (unsigned — right-click → Open the first time) |
| `finora-desktop-Linux` | `.AppImage` and `.deb` | ✅ |
| `finora-android` | debug APK (sideload for testing); signed APK + AAB with secrets | ✅ debug APK |
| `finora-ios` | Simulator build + unsigned device archive; signed `.ipa` with secrets | ✅ simulator / unsigned |

Optional repository secrets (Settings → Secrets → Actions) for signed, store-ready builds:

| Secret | Used for |
|---|---|
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Signed release APK + Play Store bundle |
| `IOS_CERTIFICATE_P12_BASE64`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_TEAM_ID` | Signed `.ipa` for TestFlight / App Store (requires an Apple Developer account, $99/year) |
| `DESKTOP_CSC_LINK`, `DESKTOP_CSC_KEY_PASSWORD` | Code-signing certificate (Windows `.pfx` / macOS Developer ID `.p12`, base64) |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarization |

Installing on a real iPhone always requires Apple signing (a developer account); everything else can be built and installed without any paid account.

## Web deployment (Render)

`render.yaml` is a Render Blueprint (PostgreSQL + one web service serving the API and the built app). In Render: **New → Blueprint → select the repo → Apply**. Migrations run on every deploy. Set `SEED_DEMO_DATA=false` for real use.

> The `money_in_paise_and_recurring` migration converts existing amounts (rupees → paise) in place. It was verified to preserve every total; still, back up a production database before deploying it.

## Offline apps: security and storage

| Concern | Desktop (Electron) | Mobile (Capacitor) |
|---|---|---|
| Database | SQLite encrypted with SQLite3MultipleCiphers (ChaCha20-Poly1305) | SQLite encrypted with SQLCipher |
| Database key | Random 256-bit key, stored encrypted with Electron `safeStorage` (DPAPI / Keychain / libsecret). If Linux has no keyring the key is only obfuscated — the app warns | Random passphrase kept by the plugin in the iOS Keychain / Android Keystore-backed storage |
| Login | Local accounts (PBKDF2-SHA256, 210k iterations); session = signed-in account id | Same |
| Migrations | Each runs in a transaction; an encrypted copy of the database is kept before upgrading (`data/backups`, last 5) | Each runs in a transaction (all-or-nothing) |
| Isolation | Sandboxed renderer, context isolation, no Node in the UI, strict CSP, private `app://` scheme, navigation and new windows blocked, all permissions denied, IPC allow-list + Zod validation + sender check, DevTools off in packaged builds, Electron fuses (no run-as-node, no inspector, asar integrity) | No remote content, no `server.url`; WebView debugging off |
| Permissions | — | None needed (no storage, camera, location). Files leave the app only via the share sheet / file picker |
| OS backups | — | Android auto-backup and device transfer are disabled (the key cannot leave the device); use Finora backups to move data |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Core (watch) + API + web app with hot reload |
| `npm run build` | Build core, server and web app |
| `npm test` | Core tests (SQLite) + API tests (PostgreSQL from `DATABASE_URL`) + mobile driver tests |
| `npm run lint` | ESLint + TypeScript for core, server and client |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` / `db:local` | Database helpers |
| `npm run desktop:install` / `desktop:start` / `desktop:dev` / `desktop:dist` | Desktop app |
| `npm run mobile:sync` / `mobile:android` / `mobile:ios` | Mobile apps |

## API overview

All routes are under `/api`; everything except register / login / health requires `Authorization: Bearer <token>` and is scoped to the signed-in user. The offline apps expose the same operations in-process.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/profile`, `PUT /auth/password`, `DELETE /auth/account` |
| Transactions | `GET /transactions?page&pageSize&search&type&categoryId&paymentMethod&startDate&endDate&sortBy&sortOrder`, `GET /transactions/export` (CSV, same filters), `GET/PUT/DELETE /transactions/:id`, `POST /transactions` |
| Recurring | `GET /recurring`, `GET /recurring/:id`, `POST /recurring`, `PUT /recurring/:id`, `DELETE /recurring/:id` |
| Categories | `GET /categories?type`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` |
| Budgets | `GET /budgets?year&month`, `GET /budgets/:id`, `POST /budgets`, `PUT /budgets/:id`, `DELETE /budgets/:id` |
| Goals | `GET /goals`, `GET /goals/:id`, `POST /goals`, `PUT /goals/:id`, `POST /goals/:id/contribute`, `DELETE /goals/:id` |
| Analytics | `GET /analytics/summary`, `/analytics/monthly`, `/analytics/categories`, `/analytics/daily` |
| Reports | `GET /reports/monthly?year&month` (data; the PDF is generated in the app) |
| Notifications | `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id` |
| Backup | `GET /backup`, `POST /backup/restore` (replaces the user's data) |

### Calculations

- **Total balance** = all-time income − all-time expenses
- **Net savings** = income − expenses (month); **savings rate** = net savings ÷ income × 100
- **Budget usage %** = spent ÷ budget × 100 → *On track* < 80%, *Near limit* 80–100%, *Exceeded* > 100%
- **Goal progress %** = saved ÷ target × 100

## Known limitations

- **No automatic sync** between devices or with the web account (by design for v1). Move data with backup files. Ids, timestamps and the shared core are sync-ready; adding sync later needs change tracking (e.g. deletion tombstones) and a sync endpoint.
- The web app keeps its JWT in `localStorage`; consider httpOnly cookies + CSRF protection and refresh tokens for a hardened deployment.
- Installed apps have no separate app lock / biometric unlock yet: whoever can use the unlocked device can open the signed-in app.
- Currency changes formatting only (no conversion). PDF reports print amounts as e.g. `INR 1,23,456.00` because the standard PDF fonts have no ₹ glyph.
- SQLite's case-insensitive search covers ASCII letters; PostgreSQL's covers all scripts.
- The PDF lists up to 1,000 transactions per month (totals always include everything; use CSV for the full list).
- Unsigned desktop builds trigger OS warnings; iOS device installs require Apple signing.
- `npm audit` reports an advisory in `deepmerge-ts` inside the Prisma CLI (migration tooling only).
