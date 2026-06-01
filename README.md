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
