# POS Backend

Next.js API backend for POS Kasir, backed by PostgreSQL and optimized for
paged POS/report workloads.

## Setup

1. Start PostgreSQL:

```bash
docker compose up -d postgres
```

2. Copy `.env.example` to `.env`.
3. Apply the database schema and functional baseline tables:

```bash
npm run db:migrate
```

If you are not using the script, create a PostgreSQL database named `pos_kasir`
and run the SQL files listed in `scripts/apply-sql.mjs` in order.

4. Install and run the API:

```bash
npm install
npm run dev
```

The dev script binds Next.js to `0.0.0.0`, so Android emulators can reach it
through `http://10.0.2.2:3000`.

5. With the API running, seed the Better Auth demo users:

```bash
npm run seed:auth
```

6. Optional: load non-functional demo/sample business data:

```bash
npm run seed:demo
```

## Demo Auth

Better Auth username/password demo accounts:

- Kasir: `kasir` / `password1234`
- Manajer: `manajer` / `password1234`
- Administrator: `admin` / `password1234`

`POST /api/auth/login` accepts `{ "username": "...", "password": "..." }` and returns a bearer token. Send it as `Authorization: Bearer <token>` for protected POS routes.

## Main Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/products?limit=&cursor=&q=&category_id=&stock_filter=`
- `POST /api/products` manager only
- `PATCH /api/products/:id` manager only
- `DELETE /api/products/:id` manager only
- `GET /api/customers?limit=&cursor=&q=`
- `POST /api/customers` manager only
- `PATCH /api/customers/:id` manager only
- `DELETE /api/customers/:id` manager only
- `GET /api/suppliers?limit=&cursor=&q=`
- `POST /api/suppliers` manager only
- `PATCH /api/suppliers/:id` manager only
- `DELETE /api/suppliers/:id` manager only
- `GET /api/customer-group-discounts`
- `POST /api/transactions`
- `GET /api/reports/sales` manager only
- `GET /api/reports/all-transactions` manager only
- `GET /api/reports/purchases` manager only
- `GET /api/reports/returns` manager only

## Maintenance Scripts

```bash
npm run db:migrate
npm run db:refresh-summaries
npm run seed:demo
npm run seed:auth
npm run seed:large
npm run perf:explain
```

## Vercel Deployment

The repository includes `.github/workflows/deploy-vercel.yml` for configurable
Vercel deployments.

Required GitHub secrets, either as repository secrets or as environment secrets
on GitHub environments named `production` and `preview`:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `DATABASE_URL`
- `BETTER_AUTH_URL`

Required Vercel environment variables:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL=https://<backend-production-domain>`
- `TRUSTED_ORIGINS=https://<frontend-production-domain>`

`TRUSTED_ORIGINS` accepts a comma-separated list of frontend origins and is
merged with localhost/emulator development origins.

The workflow runs automatically on pushes to `main` as a preview deployment.
Manual runs support these inputs:

- `target`: `preview` or `production`
- `run_migrations`: run `npm run db:migrate` after deployment
- `seed_auth`: run `npm run seed:auth` after deployment
- `seed_demo`: run `npm run seed:demo` after deployment

Recommended first production run:

1. Deploy with `target=production`.
2. Re-run with `run_migrations=true` after confirming the production database
   connection.
3. Re-run with `seed_auth=true` to create demo login users.
4. Run `seed_demo=true` only when demo/sample business data is desired.
