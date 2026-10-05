# Finora — Finance Management System

A full-stack personal finance manager: track income and expenses, set monthly and category budgets, save towards goals, and explore interactive analytics. Every number in the UI is computed by the API from PostgreSQL — nothing is hard-coded.

## Features

- **Authentication** — register / login / logout, bcrypt password hashing, JWT (Bearer) sessions, protected routes, profile editing, password change, account deletion.
- **Dashboard** — total balance, monthly income / expenses / net savings with month-over-month change, monthly budget with category progress, savings-goal progress, income vs expense chart, spending by category, monthly summary, recent transactions. Month switcher for past months.
- **Transactions** — add / edit / delete income and expenses; search (description, notes, category); filter by type, category, payment method and date range; sortable columns; pagination with page-size control; filtered totals.
- **Categories** — 10 default expense categories (Food, Transport, Shopping, Education, Bills, Entertainment, Health, Travel, Rent, Other) plus default income categories; create / edit / delete custom ones. Deleting a custom category moves its transactions to "Other".
- **Budgets** — one budget per month with optional category limits; spent, remaining, usage % and status (On track / Near limit ≥ 80% / Exceeded > 100%); cumulative spending-pace chart; budget history.
- **Goals** — target, saved amount, target date, progress %, remaining, required monthly saving, add / withdraw money.
- **Analytics** — 3 / 6 / 12-month ranges: income, expenses, net savings, savings rate, spending trends, income vs expense, savings trend, category-wise spending, income sources, budget performance, and a data table view.
- **Notifications** — budget almost exceeded, budget exceeded, goal milestones (25/50/75/100%), monthly summary; mark read / mark all read / dismiss; per-type preferences in Settings.
- **Settings** — profile, currency (INR default; display only, no conversion), light / dark / system theme, notification preferences, password change, account deletion.
- **UX** — responsive sidebar + top bar layout, modal forms, toasts, skeleton loading, empty and error states, dark mode, accessible status badges (icon + label, never colour alone), reduced-motion support for charts.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router 7, TanStack Query, Recharts, lucide-react, sonner |
| Backend | Node.js, Express 4, TypeScript, Zod validation, helmet, CORS, express-rate-limit |
| Database | PostgreSQL + Prisma ORM 6 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Tests | Vitest + Supertest (unit + end-to-end API tests) |

## Project structure

```
finance-management/
├── client/                 React app
│   └── src/
│       ├── components/     ui/, charts/, transactions/, budgets/, goals/, categories/
│       ├── context/        AuthContext, ThemeContext
│       ├── hooks/          React Query hooks, useCurrency, useDebounce
│       ├── layouts/        AppLayout (sidebar/topbar), AuthLayout, NotificationsMenu
│       ├── pages/          Dashboard, Transactions, Budgets, Goals, Analytics, Categories, Settings, Login, Register
│       ├── services/       axios instance + typed API endpoints
│       ├── types/          shared TypeScript types
│       └── utils/          formatting, constants, cn()
├── server/                 Express API
│   ├── src/
│   │   ├── config/         env validation, Prisma client, default categories
│   │   ├── controllers/    thin HTTP handlers
│   │   ├── middleware/     auth (JWT), validation, error handling
│   │   ├── routes/         REST routes
│   │   ├── services/       business logic & calculations
│   │   ├── utils/          calculations, dates, JWT, errors
│   │   └── validators/     Zod schemas
│   ├── prisma/             schema.prisma, migrations/, seed.ts
│   ├── scripts/local-db.ts optional embedded PostgreSQL for development
│   └── tests/              unit + API integration tests
├── .env.example
└── package.json            npm workspaces + root scripts
```

## Getting started

### Prerequisites

- Node.js 20+ (tested on Node 24) and npm 10+
- PostgreSQL 14+ — **or** use the bundled `npm run db:local`, which runs a real PostgreSQL server from npm with no system install

### 1. Install dependencies

```bash
cd finance-management
npm install            # installs root, server and client (npm workspaces) and generates the Prisma client
```

### 2. Configure environment

```bash
cp .env.example server/.env        # Windows PowerShell: Copy-Item .env.example server\.env
```

Edit `server/.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:PORT/finance_db?schema=public` |
| `JWT_SECRET` | Long random string (≥ 32 chars). Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Allowed browser origin(s) for CORS (default `http://localhost:5173`) |

The client needs no `.env` in development (Vite proxies `/api` to the server). Set `VITE_API_URL` in `client/.env` only if the API is hosted on another origin.

### 3. Create the database

**Option A — your own PostgreSQL**

```sql
CREATE DATABASE finance_db;
```

**Option B — no PostgreSQL installed** (development only)

```bash
npm run db:local       # keep this terminal open; data persists in server/.pgdata
```

It reads the user / password / port / database name from `DATABASE_URL` and creates the database with UTF-8 encoding.

### 4. Run migrations

```bash
npm run db:migrate     # development (prisma migrate dev)
# or, for production / CI:
npm run db:deploy      # prisma migrate deploy
```

### 5. Seed sample data (optional)

```bash
npm run db:seed
```

Creates a demo user with ~6 months of realistic INR transactions, 3 monthly budgets and 3 savings goals. Re-running replaces the demo user's data only.

### 6. Start the app

```bash
npm run dev            # API on http://localhost:5000, web app on http://localhost:5173
```

Or individually: `npm run dev -w server` and `npm run dev -w client`.

Open **http://localhost:5173**.

### Test credentials (after seeding)

| Email | Password |
|---|---|
| `demo@finance.app` | `Demo@1234` |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run API + web app with hot reload |
| `npm run build` | Type-check and build server (`server/dist`) and client (`client/dist`) |
| `npm start` | Run the built API. With `NODE_ENV=production` it also serves `client/dist` |
| `npm run lint` | ESLint + TypeScript checks for both apps |
| `npm test` | Unit tests + end-to-end API tests (requires the database from `DATABASE_URL`) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma helpers |
| `npm run db:local` | Start the embedded development PostgreSQL |

## API overview

All routes are prefixed with `/api`. Everything except register / login / health requires `Authorization: Bearer <token>`, and every query is scoped to the authenticated user.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/profile`, `PUT /auth/password`, `DELETE /auth/account` |
| Transactions | `GET /transactions?page&pageSize&search&type&categoryId&paymentMethod&startDate&endDate&sortBy&sortOrder`, `GET /transactions/:id`, `POST /transactions`, `PUT /transactions/:id`, `DELETE /transactions/:id` |
| Categories | `GET /categories?type`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` |
| Budgets | `GET /budgets?year&month`, `GET /budgets/:id`, `POST /budgets`, `PUT /budgets/:id`, `DELETE /budgets/:id` |
| Goals | `GET /goals`, `GET /goals/:id`, `POST /goals`, `PUT /goals/:id`, `POST /goals/:id/contribute`, `DELETE /goals/:id` |
| Analytics | `GET /analytics/summary?year&month`, `GET /analytics/monthly?months&year&month`, `GET /analytics/categories?type&startDate&endDate`, `GET /analytics/daily?year&month` |
| Notifications | `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`, `DELETE /notifications/:id` |
| Health | `GET /health` |

### Calculations

- **Total balance** = all-time income − all-time expenses
- **Net savings** = income − expenses (selected month); **savings rate** = net savings ÷ income × 100
- **Budget remaining** = budget amount − expenses in that month (overall or per category)
- **Budget usage %** = expenses ÷ budget amount × 100 → *On track* < 80%, *Near limit* 80–100%, *Exceeded* > 100%
- **Goal progress %** = saved ÷ target × 100

All values are calculated server-side on each request; the client invalidates its cached queries after every create / edit / delete, so the dashboard, budgets and analytics update immediately.

## Security

- Passwords hashed with bcrypt (12 rounds); hashes are never returned by the API.
- JWT signed with HS256 using a secret from the environment (validated at start-up, min. 32 chars).
- Every data query filters by the authenticated user ID; another user's records return 404.
- Zod validation on all request bodies and query strings; Prisma parameterised queries (including the one raw analytics query) prevent SQL injection.
- helmet security headers, restricted CORS origin, 100 kb JSON body limit, rate limiting on auth endpoints, generic error messages in production.

## Notes and known limitations

- The JWT is kept in `localStorage` for simplicity. For a hardened deployment consider httpOnly cookies + CSRF protection, plus refresh tokens.
- Currency setting changes display formatting only; amounts are not converted.
- `npm audit` reports an advisory in `deepmerge-ts`, used by the **Prisma CLI's** config loader (development / migration tooling, not the running API). It will clear when Prisma ships an updated dependency.
- npm 11 may print an `install-scripts` warning listing Prisma, esbuild and embedded-postgres; these are the expected build scripts.
